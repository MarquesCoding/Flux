//! Seek-bar previews, against real media, through the real HTTP surface.
//!
//! The unit tests prove the filter chain and the cue geometry are what Flux
//! meant to write. Only running ffmpeg proves the chain renders a sheet a
//! browser can draw.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use flux_transcoder::router::{create_router, AppState};
use flux_transcoder::session::{SessionConfig, SessionRegistry};

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn ffprobe() -> String {
    std::env::var("FLUX_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

/// A file long enough to need more than one thumbnail.
fn source_file() -> PathBuf {
    let directory = std::env::temp_dir().join("flux-fixtures");

    std::fs::create_dir_all(&directory).expect("creates the fixture directory");

    let path = directory.join("trickplay-source.mp4");

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=640x360:rate=25",
            "-t",
            "12",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
        ])
        .arg("-y")
        .arg(&path)
        .status()
        .expect("runs ffmpeg");

    assert!(status.success(), "could not generate the source fixture");

    path
}

fn app(name: &str) -> axum::Router {
    create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            ffmpeg: ffmpeg(),
            cache_root: std::env::temp_dir().join(format!("flux-test-trickplay-{name}")),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        ffprobe: ffprobe(),
        media_roots: Vec::new(),
    })
}

async fn call(app: &axum::Router, request: Request<Body>) -> (StatusCode, Vec<u8>) {
    let response = app
        .clone()
        .oneshot(request)
        .await
        .expect("handles the request");
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("reads the body")
        .to_bytes()
        .to_vec();

    (status, bytes)
}

fn request(body: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/trickplay")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .expect("builds the request")
}

fn body(interval: u32) -> serde_json::Value {
    serde_json::json!({
        "inputPath": source_file().to_string_lossy(),
        "intervalSeconds": interval,
        "tileWidth": 160,
        "columns": 2,
        "rows": 2,
    })
}

#[tokio::test]
async fn renders_sheets_a_browser_can_draw() {
    let app = app("renders");

    let (status, bytes) = call(&app, request(body(4))).await;

    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&bytes)
    );

    let index: serde_json::Value = serde_json::from_slice(&bytes).expect("reads the index");
    let sheets = index["sheets"].as_array().expect("lists the sheets");

    assert!(!sheets.is_empty(), "no sheets were rendered");

    let name = sheets[0].as_str().expect("names the sheet");
    let id = index["id"].as_str().expect("names the set");

    let (status, sheet) = call(
        &app,
        Request::builder()
            .uri(format!("/trickplay/{id}/{name}"))
            .body(Body::empty())
            .expect("builds the request"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    // A JPEG starts with the SOI marker. Asserting on bytes rather than length
    // is what separates "ffmpeg wrote a file" from "ffmpeg wrote an image".
    assert_eq!(&sheet[..2], &[0xFF, 0xD8], "the sheet is not a JPEG");
}

#[tokio::test]
async fn the_thumbnail_shape_follows_the_source() {
    let (status, bytes) = call(&app("shape"), request(body(4))).await;

    assert_eq!(status, StatusCode::OK);

    let index: serde_json::Value = serde_json::from_slice(&bytes).expect("reads the index");

    assert_eq!(index["tileWidth"], 160);
    assert_eq!(index["tileHeight"], 90);
}

#[tokio::test]
async fn serves_an_index_every_player_understands() {
    let app = app("index");
    let (_, bytes) = call(&app, request(body(4))).await;
    let index: serde_json::Value = serde_json::from_slice(&bytes).expect("reads the index");
    let path = index["index"].as_str().expect("names the index");

    let (status, vtt) = call(
        &app,
        Request::builder()
            .uri(path)
            .body(Body::empty())
            .expect("builds the request"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);

    let text = String::from_utf8_lossy(&vtt);

    assert!(text.starts_with("WEBVTT"));
    assert!(text.contains("#xywh="));
    assert_eq!(text.matches("-->").count(), 3, "{text}");
}

#[tokio::test]
async fn asking_twice_reuses_the_sheets_rather_than_decoding_again() {
    let app = app("reuse");

    let (_, first) = call(&app, request(body(4))).await;
    let first: serde_json::Value = serde_json::from_slice(&first).expect("reads the index");

    let (status, second) = call(&app, request(body(4))).await;
    let second: serde_json::Value = serde_json::from_slice(&second).expect("reads the index");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(first["id"], second["id"]);
    assert_eq!(first["sheets"], second["sheets"]);
}

#[tokio::test]
async fn refuses_a_file_outside_the_media_roots() {
    let app = create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            ffmpeg: ffmpeg(),
            cache_root: std::env::temp_dir().join("flux-test-trickplay-confined"),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        ffprobe: ffprobe(),
        media_roots: vec![PathBuf::from("/nowhere")],
    });

    let (status, _) = call(&app, request(body(4))).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
}
