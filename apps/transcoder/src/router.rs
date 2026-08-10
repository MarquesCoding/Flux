use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use crate::capability::{detect_capabilities, Capabilities};
use crate::probe::probe_media;
use crate::session::{await_manifest, SessionRegistry};
use crate::transcode_plan::{SessionSpec, MANIFEST_NAME};

const MANIFEST_TIMEOUT: Duration = Duration::from_secs(20);

/// Everything the routes need.
#[derive(Clone)]
pub struct AppState {
    pub registry: SessionRegistry,
    pub ffprobe: String,
    /// Directories the media service will read from.
    ///
    /// The service has no authentication of its own, so without this any
    /// caller that can reach the socket could read any file the process can.
    pub media_roots: Vec<PathBuf>,
}

impl AppState {
    /// Whether a path lies inside a configured media root.
    #[must_use]
    pub fn is_readable(&self, path: &Path) -> bool {
        if self.media_roots.is_empty() {
            return true;
        }

        self.media_roots.iter().any(|root| path.starts_with(root))
    }
}

#[derive(Debug, Deserialize)]
pub struct ProbeRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileQuery {
    pub path: String,
}

/// One byte range, as parsed from a `Range` header.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

/// Parses a single-range `Range` header.
///
/// Only one range is supported, which is all a video element ever asks for.
/// Multi-range requests are answered with the whole file rather than a
/// malformed multipart response.
#[must_use]
pub fn parse_range(header: &str, length: u64) -> Option<ByteRange> {
    if length == 0 {
        return None;
    }

    let spec = header.strip_prefix("bytes=")?;

    if spec.contains(',') {
        return None;
    }

    let (from, to) = spec.split_once('-')?;

    let range = match (from.trim(), to.trim()) {
        ("", "") => return None,
        // A suffix range: the last N bytes.
        ("", last) => {
            let count: u64 = last.parse().ok()?;
            let count = count.min(length);

            ByteRange {
                start: length - count,
                end: length - 1,
            }
        }
        (first, "") => ByteRange {
            start: first.parse().ok()?,
            end: length - 1,
        },
        (first, last) => ByteRange {
            start: first.parse().ok()?,
            end: last.parse::<u64>().ok()?.min(length - 1),
        },
    };

    if range.start > range.end || range.start >= length {
        return None;
    }

    Some(range)
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub manifest: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

fn error(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(ErrorResponse {
            error: message.to_owned(),
        }),
    )
        .into_response()
}

/// Rejects any segment name that is not a plain file name.
///
/// Segment names arrive in the URL, so without this a request for
/// `../../etc/passwd` would be served from the session directory. Rejecting
/// anything containing a separator or a parent component is simpler to reason
/// about than trying to canonicalise afterwards.
fn is_safe_segment_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 128 {
        return false;
    }

    Path::new(name).components().count() == 1
        && Path::new(name)
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn content_type_for(name: &str) -> &'static str {
    let extension = Path::new(name)
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "m3u8" => "application/vnd.apple.mpegurl",
        "m4s" | "mp4" => "video/mp4",
        _ => "application/octet-stream",
    }
}

async fn serve_file(directory: &Path, name: &str) -> Response {
    if !is_safe_segment_name(name) {
        return error(StatusCode::BAD_REQUEST, "Invalid segment name.");
    }

    let path: PathBuf = directory.join(name);

    match tokio::fs::read(&path).await {
        Ok(bytes) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, content_type_for(name))],
            bytes,
        )
            .into_response(),
        Err(_) => error(StatusCode::NOT_FOUND, "No such segment."),
    }
}

#[allow(clippy::unused_async, reason = "axum handlers must be async")]
/// Serves an original file, honouring byte ranges.
///
/// Direct play is the cheapest delivery there is: no transcode, no remux, no
/// segment cache, just the file. A video element seeks with `Range` requests,
/// so a server that ignores them forces the browser to download from the start
/// every time the viewer scrubs.
async fn direct_file(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FileQuery>,
) -> Response {
    let path = PathBuf::from(&query.path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    let Ok(metadata) = tokio::fs::metadata(&path).await else {
        return error(StatusCode::NOT_FOUND, "No such file.");
    };

    let length = metadata.len();

    let Ok(bytes) = tokio::fs::read(&path).await else {
        return error(StatusCode::NOT_FOUND, "No such file.");
    };

    let requested = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| parse_range(value, length));

    let content_type = content_type_for(&query.path);

    match requested {
        None => (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, content_type.to_owned()),
                (header::ACCEPT_RANGES, "bytes".to_owned()),
            ],
            bytes,
        )
            .into_response(),
        Some(range) => {
            let start = usize::try_from(range.start).unwrap_or(0);
            let end = usize::try_from(range.end).unwrap_or(bytes.len() - 1);
            let slice = bytes[start..=end.min(bytes.len() - 1)].to_vec();

            (
                StatusCode::PARTIAL_CONTENT,
                [
                    (header::CONTENT_TYPE, content_type.to_owned()),
                    (header::ACCEPT_RANGES, "bytes".to_owned()),
                    (
                        header::CONTENT_RANGE,
                        format!("bytes {}-{}/{length}", range.start, range.end),
                    ),
                ],
                slice,
            )
                .into_response()
        }
    }
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn capabilities(State(state): State<AppState>) -> Json<Capabilities> {
    Json(detect_capabilities(&state.registry.config().ffmpeg).await)
}

async fn probe(State(state): State<AppState>, Json(request): Json<ProbeRequest>) -> Response {
    match probe_media(&state.ffprobe, Path::new(&request.path)).await {
        Ok(result) => (StatusCode::OK, Json(result)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

async fn start_session(State(state): State<AppState>, Json(spec): Json<SessionSpec>) -> Response {
    if !tokio::fs::try_exists(&spec.input_path)
        .await
        .unwrap_or(false)
    {
        return error(StatusCode::NOT_FOUND, "No such input file.");
    }

    let id = match state.registry.start(spec).await {
        Ok(id) => id,
        Err(failure) => {
            return error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string());
        }
    };

    let Some(directory) = state.registry.touch(&id).await else {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "The session disappeared.",
        );
    };

    if !await_manifest(&directory.join(MANIFEST_NAME), MANIFEST_TIMEOUT).await {
        state.registry.stop(&id).await;

        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ffmpeg produced no manifest.",
        );
    }

    (
        StatusCode::OK,
        Json(SessionResponse {
            manifest: format!("/sessions/{id}/{MANIFEST_NAME}"),
            id,
        }),
    )
        .into_response()
}

async fn session_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
) -> Response {
    let Some(directory) = state.registry.touch(&id).await else {
        return error(StatusCode::NOT_FOUND, "No such session.");
    };

    serve_file(&directory, &name).await
}

async fn stop_session(State(state): State<AppState>, AxumPath(id): AxumPath<String>) -> Response {
    if state.registry.stop(&id).await {
        return (StatusCode::NO_CONTENT, Body::empty()).into_response();
    }

    error(StatusCode::NOT_FOUND, "No such session.")
}

/// Builds the media service routes.
///
/// Returned as a router rather than a bound server so the whole surface can be
/// exercised in tests without a socket.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/capabilities", get(capabilities))
        .route("/probe", post(probe))
        .route("/file", get(direct_file))
        .route("/sessions", post(start_session))
        .route("/sessions/{id}/{name}", get(session_file))
        .route("/sessions/{id}", axum::routing::delete(stop_session))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::{content_type_for, is_safe_segment_name, parse_range};

    #[test]
    fn reads_a_range_from_the_start() {
        assert_eq!(
            parse_range("bytes=0-99", 1000),
            Some(super::ByteRange { start: 0, end: 99 })
        );
    }

    #[test]
    fn reads_an_open_ended_range() {
        assert_eq!(
            parse_range("bytes=500-", 1000),
            Some(super::ByteRange {
                start: 500,
                end: 999
            })
        );
    }

    #[test]
    fn reads_a_suffix_range() {
        assert_eq!(
            parse_range("bytes=-100", 1000),
            Some(super::ByteRange {
                start: 900,
                end: 999
            })
        );
    }

    #[test]
    fn clamps_a_range_that_runs_past_the_end() {
        assert_eq!(
            parse_range("bytes=900-5000", 1000),
            Some(super::ByteRange {
                start: 900,
                end: 999
            })
        );
    }

    #[test]
    fn rejects_a_range_starting_past_the_end() {
        assert_eq!(parse_range("bytes=2000-", 1000), None);
    }

    #[test]
    fn rejects_a_backwards_range() {
        assert_eq!(parse_range("bytes=500-100", 1000), None);
    }

    #[test]
    fn ignores_multi_range_requests_rather_than_answering_them_badly() {
        assert_eq!(parse_range("bytes=0-99,200-299", 1000), None);
    }

    #[test]
    fn rejects_nonsense() {
        assert_eq!(parse_range("pages=1-2", 1000), None);
        assert_eq!(parse_range("bytes=", 1000), None);
        assert_eq!(parse_range("bytes=-", 1000), None);
    }

    #[test]
    fn accepts_ordinary_segment_names() {
        assert!(is_safe_segment_name("segment00001.m4s"));
        assert!(is_safe_segment_name("index.m3u8"));
        assert!(is_safe_segment_name("init.mp4"));
    }

    #[test]
    fn rejects_parent_traversal() {
        assert!(!is_safe_segment_name("../secrets"));
        assert!(!is_safe_segment_name("../../etc/passwd"));
    }

    #[test]
    fn rejects_nested_paths() {
        assert!(!is_safe_segment_name("nested/segment.m4s"));
    }

    #[test]
    fn rejects_absolute_paths() {
        assert!(!is_safe_segment_name("/etc/passwd"));
    }

    #[test]
    fn rejects_empty_and_overlong_names() {
        assert!(!is_safe_segment_name(""));
        assert!(!is_safe_segment_name(&"a".repeat(200)));
    }

    #[test]
    fn serves_playlists_and_segments_with_useful_types() {
        assert_eq!(
            content_type_for("index.m3u8"),
            "application/vnd.apple.mpegurl"
        );
        assert_eq!(content_type_for("segment1.m4s"), "video/mp4");
        assert_eq!(content_type_for("init.mp4"), "video/mp4");
        assert_eq!(content_type_for("notes.txt"), "application/octet-stream");
    }
}
