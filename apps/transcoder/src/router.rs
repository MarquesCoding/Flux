use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path as AxumPath, State};
use axum::http::{header, StatusCode};
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
}

#[derive(Debug, Deserialize)]
pub struct ProbeRequest {
    pub path: String,
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
        .route("/sessions", post(start_session))
        .route("/sessions/{id}/{name}", get(session_file))
        .route("/sessions/{id}", axum::routing::delete(stop_session))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::{content_type_for, is_safe_segment_name};

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
