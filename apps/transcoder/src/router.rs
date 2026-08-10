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
use crate::colour::{sample_colour, ColourRequest};
use crate::fingerprint::{fingerprint, FingerprintRequest};
use crate::frame::{take_frame, FrameRequest};
use crate::monitor::{Monitor, Report};
use crate::preview::{
    directory_for as preview_directory, generate as generate_preview, is_complete as preview_ready,
    PreviewClip, PreviewRequest,
};
use crate::probe::probe_media;
use crate::queue::WorkQueue;
use crate::session::{await_manifest, SessionRegistry};
use crate::subtitle::{extract_subtitle, SubtitleRequest};
use crate::transcode_plan::{SessionSpec, MANIFEST_NAME};
use crate::trickplay::{
    directory_for, is_complete, pending_index, tile_height_for, TrickplayRegistry, TrickplayRequest,
};

const MANIFEST_TIMEOUT: Duration = Duration::from_secs(20);

/// How often a watching page is sent a new reading.
///
/// A second is fast enough to watch a transcode start and slow enough that
/// measuring costs less than the thing being measured.
const MONITOR_INTERVAL: Duration = Duration::from_secs(1);

/// What to call a file in a list of work.
///
/// The name alone: an operator watching a queue recognises "Parasite.mkv" and
/// learns nothing from the eighty characters of path in front of it.
fn name_of(path: &Path) -> String {
    path.file_name().map_or_else(
        || path.to_string_lossy().into_owned(),
        |name| name.to_string_lossy().into_owned(),
    )
}

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
    /// Keeps one set of thumbnails from being rendered twice at once.
    pub trickplay: TrickplayRegistry,
    /// Where background work waits its turn.
    ///
    /// Everything that reads a whole file goes through here, so there is a
    /// ceiling on how much of the machine work nobody is waiting for can take.
    pub queue: WorkQueue,
    /// What the machine is using, and what has happened lately.
    pub monitor: Monitor,
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
        "jpg" | "jpeg" => "image/jpeg",
        "vtt" => "text/vtt",
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

/// Makes the short clip a library page plays.
///
/// Encoded once and served as a file afterwards, so a wall of cards playing
/// previews costs nothing running: the alternative is half a dozen transcodes
/// competing with whatever somebody is actually watching.
async fn start_preview(
    State(state): State<AppState>,
    Json(request): Json<PreviewRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    let config = state.registry.config().clone();
    let id = request.id();

    if preview_ready(&config.cache_root, &id).await {
        return (
            StatusCode::OK,
            Json(PreviewClip {
                url: format!("/previews/{id}/{}", crate::preview::PREVIEW_NAME),
                id,
                is_ready: true,
            }),
        )
            .into_response();
    }

    let probe = match probe_media(&state.ffprobe, &path).await {
        Ok(probe) => probe,
        Err(failure) => return error(StatusCode::BAD_REQUEST, &failure.to_string()),
    };

    let Some(video) = probe.video.as_ref() else {
        return error(StatusCode::BAD_REQUEST, "That file has no video stream.");
    };

    let range = video.range;
    let tone_mapping = detect_capabilities(&config.ffmpeg).await.tone_mapping;
    let duration = probe.duration_seconds;

    if !request.wait {
        let queue = state.queue.clone();
        let subject = name_of(&path);
        let queued = request.clone();
        let ffmpeg = config.ffmpeg.clone();
        let cache_root = config.cache_root.clone();

        tokio::spawn(async move {
            let _ = queue
                .run(
                    "preview",
                    &subject,
                    generate_preview(&ffmpeg, &cache_root, &queued, range, tone_mapping, duration),
                )
                .await;
        });

        return (
            StatusCode::ACCEPTED,
            Json(PreviewClip {
                url: format!("/previews/{id}/{}", crate::preview::PREVIEW_NAME),
                id,
                is_ready: false,
            }),
        )
            .into_response();
    }

    match state
        .queue
        .run(
            "preview",
            &name_of(&path),
            generate_preview(
                &config.ffmpeg,
                &config.cache_root,
                &request,
                range,
                tone_mapping,
                duration,
            ),
        )
        .await
    {
        Ok(clip) => (StatusCode::OK, Json(clip)).into_response(),
        Err(failure) => error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string()),
    }
}

/// Serves a made clip.
async fn preview_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
) -> Response {
    let directory = preview_directory(&state.registry.config().cache_root, &id);

    serve_file(&directory, &name).await
}

/// Takes a single frame out of a file.
///
/// Answers with the JPEG itself rather than a path, because the caller is
/// about to put it on a page and a second round trip would defeat the point of
/// having it early.
async fn start_frame(State(state): State<AppState>, Json(request): Json<FrameRequest>) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match take_frame(
        &state.registry.config().ffmpeg,
        &path,
        request.at_seconds,
        request.width,
    )
    .await
    {
        Ok(picture) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            picture,
        )
            .into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// Reads one subtitle track out of a container.
///
/// Answers with the whole track rather than a path, because a subtitle file is
/// a few tens of kilobytes and the player wants all of it before the first cue
/// is due.
async fn start_subtitle(
    State(state): State<AppState>,
    Json(request): Json<SubtitleRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match extract_subtitle(&state.registry.config().ffmpeg, &path, request.stream_index).await {
        Ok(track) => (StatusCode::OK, Json(track)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// Renders seek-bar previews for a file.
///
/// Answers with the index rather than the images: the player fetches sheets
/// only for the part of the timeline the viewer actually hovers over.
async fn start_trickplay(
    State(state): State<AppState>,
    Json(request): Json<TrickplayRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    let probe = match probe_media(&state.ffprobe, &path).await {
        Ok(probe) => probe,
        Err(failure) => return error(StatusCode::BAD_REQUEST, &failure.to_string()),
    };

    let Some(video) = probe.video.as_ref() else {
        return error(StatusCode::BAD_REQUEST, "That file has no video stream.");
    };

    let config = state.registry.config();

    // A caller that will not wait is told where the thumbnails will be and
    // left to get on with playing the film. Rendering carries on behind it, so
    // asking again a minute later finds them ready.
    if !request.wait {
        let id = request.id();

        if !is_complete(&config.cache_root, &id).await {
            let tile_height = tile_height_for(request.tile_width, video.width, video.height);
            let pending = pending_index(&request, tile_height);
            let trickplay = state.trickplay.clone();
            let ffmpeg = config.ffmpeg.clone();
            let cache_root = config.cache_root.clone();
            let queued = request.clone();
            let (width, height, duration) = (video.width, video.height, probe.duration_seconds);

            let queue = state.queue.clone();
            let subject = name_of(&path);

            tokio::spawn(async move {
                let _ = queue
                    .run(
                        "thumbnails",
                        &subject,
                        trickplay.generate(&ffmpeg, &cache_root, &queued, width, height, duration),
                    )
                    .await;
            });

            return (StatusCode::ACCEPTED, Json(pending)).into_response();
        }
    }

    match state
        .queue
        .run(
            "thumbnails",
            &name_of(&path),
            state.trickplay.generate(
                &config.ffmpeg,
                &config.cache_root,
                &request,
                video.width,
                video.height,
                probe.duration_seconds,
            ),
        )
        .await
    {
        Ok(index) => (StatusCode::OK, Json(index)).into_response(),
        Err(failure) => error(StatusCode::INTERNAL_SERVER_ERROR, &failure.to_string()),
    }
}

async fn trickplay_file(
    State(state): State<AppState>,
    AxumPath((id, name)): AxumPath<(String, String)>,
) -> Response {
    serve_file(
        &directory_for(&state.registry.config().cache_root, &id),
        &name,
    )
    .await
}

/// Fingerprints a window of a file's audio.
///
/// Answers with the hashes rather than a verdict: deciding what two episodes
/// share is arithmetic over those hashes, and arithmetic does not belong in
/// the service that owns `FFmpeg`.
async fn start_fingerprint(
    State(state): State<AppState>,
    Json(request): Json<FingerprintRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match state
        .queue
        .run(
            "fingerprint",
            &name_of(&PathBuf::from(&request.input_path)),
            fingerprint(&state.registry.config().ffmpeg, &request),
        )
        .await
    {
        Ok(prints) => (StatusCode::OK, Json(prints)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

/// Takes the colour a file feels like.
///
/// Answers with one colour rather than a palette: the interface lights a page
/// with it, and a page lit by five colours at once is a mess.
async fn start_colour(
    State(state): State<AppState>,
    Json(request): Json<ColourRequest>,
) -> Response {
    let path = PathBuf::from(&request.input_path);

    if !state.is_readable(&path) {
        return error(
            StatusCode::FORBIDDEN,
            "That file is outside the media roots.",
        );
    }

    match state
        .queue
        .run(
            "colour",
            &name_of(&PathBuf::from(&request.input_path)),
            sample_colour(&state.registry.config().ffmpeg, &request),
        )
        .await
    {
        Ok(colour) => (StatusCode::OK, Json(colour)).into_response(),
        Err(failure) => error(StatusCode::BAD_REQUEST, &failure.to_string()),
    }
}

async fn stop_session(State(state): State<AppState>, AxumPath(id): AxumPath<String>) -> Response {
    if state.registry.stop(&id).await {
        return (StatusCode::NO_CONTENT, Body::empty()).into_response();
    }

    error(StatusCode::NOT_FOUND, "No such session.")
}

/// Everything an operator watching the server reads.
///
/// One request rather than four, because these are read together and read
/// often: a page refreshing four endpoints a second is four times the work for
/// no more information.
async fn monitor(State(state): State<AppState>) -> Response {
    let report = Report {
        resources: state.monitor.measure().await,
        queue: state.queue.snapshot().await,
        sessions: state.registry.len().await,
        logs: state.monitor.journal().read().await,
    };

    (StatusCode::OK, Json(report)).into_response()
}

/// The same report, over and over, as an event stream.
///
/// Server-sent events rather than a socket: this is one direction only, it
/// reconnects on its own, and it survives a proxy that knows nothing about it.
async fn monitor_stream(State(state): State<AppState>) -> Response {
    let stream = async_stream::stream! {
        let mut ticker = tokio::time::interval(MONITOR_INTERVAL);

        loop {
            ticker.tick().await;

            let report = Report {
                resources: state.monitor.measure().await,
                queue: state.queue.snapshot().await,
                sessions: state.registry.len().await,
                logs: state.monitor.journal().read().await,
            };

            match serde_json::to_string(&report) {
                Ok(payload) => yield Ok::<_, std::convert::Infallible>(
                    axum::response::sse::Event::default().data(payload),
                ),
                Err(_) => continue,
            }
        }
    };

    axum::response::Sse::new(stream)
        .keep_alive(axum::response::sse::KeepAlive::default())
        .into_response()
}

/// Builds the media service routes.
///
/// Returned as a router rather than a bound server so the whole surface can be
/// exercised in tests without a socket.
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/monitor", get(monitor))
        .route("/monitor/stream", get(monitor_stream))
        .route("/capabilities", get(capabilities))
        .route("/probe", post(probe))
        .route("/file", get(direct_file))
        .route("/sessions", post(start_session))
        .route("/sessions/{id}/{name}", get(session_file))
        .route("/sessions/{id}", axum::routing::delete(stop_session))
        .route("/colour", post(start_colour))
        .route("/fingerprint", post(start_fingerprint))
        .route("/frame", post(start_frame))
        .route("/previews", post(start_preview))
        .route("/previews/{id}/{name}", get(preview_file))
        .route("/subtitles", post(start_subtitle))
        .route("/trickplay", post(start_trickplay))
        .route("/trickplay/{id}/{name}", get(trickplay_file))
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
