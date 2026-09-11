//! The sweep endpoints, and the thing that makes them safe.
//!
//! A sweep is told what is still wanted as the requests that would ask for it,
//! never as addresses. The address is a hash of the request, so a caller that
//! computed one itself would be a second implementation of the naming scheme —
//! and the first time the two disagreed, the sweep would delete every artefact
//! still in use.
//!
//! What is tested here is that the endpoint recognises a live artefact from the
//! request that made it. Whether a doomed directory is actually removed is unit
//! tested against the sweep itself, because a freshly made directory is inside
//! the grace period by definition and this cannot backdate one.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use valence_transcoder::monitor::{Journal, Monitor};
use valence_transcoder::preview::PreviewQuality;
use valence_transcoder::preview::PreviewRegistry;
use valence_transcoder::preview::PreviewRequest;
use valence_transcoder::queue::WorkQueue;
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::trickplay::{TrickplayRegistry, TrickplayRequest};

mod common;

use common::{ffmpeg, ffprobe};

fn cache_root(name: &str) -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("valence-test-sweep-{name}"));

    std::fs::remove_dir_all(&path).ok();

    path
}

fn app(root: std::path::PathBuf) -> axum::Router {
    create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
            ffmpeg: ffmpeg(),
            ffprobe: ffprobe(),
            cache_root: root,
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        ffprobe: ffprobe(),
        downloads: valence_transcoder::download::DownloadRegistry::new(),
        trickplay: TrickplayRegistry::default(),
        previews: PreviewRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        media_roots: Vec::new(),
    })
}

fn artefact(root: &std::path::Path, kind: &str, id: &str) {
    let directory = root.join(kind).join(id);

    std::fs::create_dir_all(&directory).expect("creates the artefact");
    std::fs::write(directory.join(".complete"), b"").expect("marks it complete");
}

async fn post(app: &axum::Router, path: &str, body: serde_json::Value) -> serde_json::Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("builds the request"),
        )
        .await
        .expect("handles the request");

    assert_eq!(response.status(), StatusCode::OK);

    serde_json::from_slice(
        &response
            .into_body()
            .collect()
            .await
            .expect("reads the body")
            .to_bytes(),
    )
    .expect("parses the report")
}

fn preview_request() -> PreviewRequest {
    PreviewRequest {
        input_path: "/media/kept.mkv".to_owned(),
        generation: 0,
        at_seconds: None,
        duration_seconds: 24,
        width: None,
        quality: PreviewQuality::High,
        hardware_accel: None,
        wait: false,
        audio_stream_index: None,
        owner: None,
    }
}

#[tokio::test]
async fn recognises_a_live_clip_from_the_request_that_made_it() {
    let root = cache_root("previews");
    let live = preview_request();

    artefact(&root, "previews", &live.id());
    artefact(&root, "previews", "0123456789abcdef0123456789abcdef");

    let report = post(
        &app(root),
        "/previews/sweep",
        serde_json::json!({
            "keep": [{
                "inputPath": live.input_path,
                "generation": live.generation,
                "durationSeconds": live.duration_seconds,
                "width": live.width,
            }],
        }),
    )
    .await;

    assert_eq!(
        report.get("kept").and_then(serde_json::Value::as_u64),
        Some(1),
        "the endpoint must address a clip exactly as the code that wrote it does"
    );
    assert_eq!(
        report.get("tooNew").and_then(serde_json::Value::as_u64),
        Some(1),
        "the orphan is doomed, but not while it is inside the grace period"
    );
    assert_eq!(
        report.get("removed").and_then(serde_json::Value::as_u64),
        Some(0)
    );
}

#[tokio::test]
async fn recognises_live_sheets_from_the_request_that_drew_them() {
    let root = cache_root("trickplay");
    let live = TrickplayRequest {
        input_path: "/media/kept.mkv".to_owned(),
        generation: 3,
        interval_seconds: 10,
        tile_width: 320,
        columns: 10,
        rows: 10,
        hardware_accel: None,
        wait: true,
        owner: None,
    };

    artefact(&root, "trickplay", &live.id());

    let report = post(
        &app(root),
        "/trickplay/sweep",
        serde_json::json!({
            "keep": [{
                "inputPath": live.input_path,
                "generation": live.generation,
                "intervalSeconds": live.interval_seconds,
                "tileWidth": live.tile_width,
                "columns": live.columns,
                "rows": live.rows,
            }],
        }),
    )
    .await;

    assert_eq!(
        report.get("kept").and_then(serde_json::Value::as_u64),
        Some(1)
    );
    assert_eq!(
        report.get("removed").and_then(serde_json::Value::as_u64),
        Some(0)
    );
}

#[tokio::test]
async fn a_generation_that_moved_on_no_longer_addresses_the_old_sheets() {
    let root = cache_root("generation");
    let before = TrickplayRequest {
        input_path: "/media/kept.mkv".to_owned(),
        generation: 1,
        interval_seconds: 10,
        tile_width: 320,
        columns: 10,
        rows: 10,
        hardware_accel: None,
        wait: true,
        owner: None,
    };

    artefact(&root, "trickplay", &before.id());

    let report = post(
        &app(root),
        "/trickplay/sweep",
        serde_json::json!({
            "keep": [{
                "inputPath": before.input_path,
                "generation": before.generation + 1,
                "intervalSeconds": before.interval_seconds,
                "tileWidth": before.tile_width,
                "columns": before.columns,
                "rows": before.rows,
            }],
        }),
    )
    .await;

    assert_eq!(
        report.get("kept").and_then(serde_json::Value::as_u64),
        Some(0),
        "sheets from before a reset are exactly what a sweep is for"
    );
}

#[tokio::test]
async fn forgetting_a_clip_removes_the_one_the_request_addresses() {
    let root = cache_root("forget");
    let doomed = preview_request();

    artefact(&root, "previews", &doomed.id());
    artefact(&root, "previews", "0123456789abcdef0123456789abcdef");

    let report = post(
        &app(root.clone()),
        "/previews/forget",
        serde_json::json!({
            "inputPath": doomed.input_path,
            "generation": doomed.generation,
            "durationSeconds": doomed.duration_seconds,
            "width": doomed.width,
        }),
    )
    .await;

    assert_eq!(
        report.get("forgotten").and_then(serde_json::Value::as_bool),
        Some(true)
    );
    assert!(!root.join("previews").join(doomed.id()).exists());
    assert!(
        root.join("previews")
            .join("0123456789abcdef0123456789abcdef")
            .exists(),
        "forgetting one clip must not disturb another"
    );
}

#[tokio::test]
async fn forgetting_a_clip_that_was_never_made_is_not_an_error() {
    let root = cache_root("forget-absent");
    let never = preview_request();

    std::fs::create_dir_all(root.join("previews")).expect("creates the cache");

    let report = post(
        &app(root),
        "/previews/forget",
        serde_json::json!({
            "inputPath": never.input_path,
            "generation": never.generation,
            "durationSeconds": never.duration_seconds,
            "width": never.width,
        }),
    )
    .await;

    assert_eq!(
        report.get("forgotten").and_then(serde_json::Value::as_bool),
        Some(false),
        "an operator asking twice should be told the second one found nothing"
    );
}

#[tokio::test]
async fn keeps_nothing_alive_when_a_library_is_empty() {
    let root = cache_root("empty");

    artefact(&root, "previews", "0123456789abcdef0123456789abcdef");

    let report = post(
        &app(root),
        "/previews/sweep",
        serde_json::json!({ "keep": [] }),
    )
    .await;

    assert_eq!(
        report.get("kept").and_then(serde_json::Value::as_u64),
        Some(0)
    );
}
