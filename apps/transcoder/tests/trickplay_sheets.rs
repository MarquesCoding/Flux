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

use flux_transcoder::monitor::{Journal, Monitor};
use flux_transcoder::queue::WorkQueue;
use flux_transcoder::router::{create_router, AppState};
use flux_transcoder::session::{SessionConfig, SessionRegistry};
use flux_transcoder::trickplay::TrickplayRegistry;

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
        trickplay: TrickplayRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
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

fn request(body: &serde_json::Value) -> Request<Body> {
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

    let (status, bytes) = call(&app, request(&body(4))).await;

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
    assert_eq!(&sheet[..2], &[0xFF, 0xD8], "the sheet is not a JPEG");
}

#[tokio::test]
async fn the_thumbnail_shape_follows_the_source() {
    let (status, bytes) = call(&app("shape"), request(&body(4))).await;

    assert_eq!(status, StatusCode::OK);

    let index: serde_json::Value = serde_json::from_slice(&bytes).expect("reads the index");

    assert_eq!(index["tileWidth"], 160);
    assert_eq!(index["tileHeight"], 90);
}

#[tokio::test]
async fn serves_an_index_every_player_understands() {
    let app = app("index");
    let (_, bytes) = call(&app, request(&body(4))).await;
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

    let (_, first) = call(&app, request(&body(4))).await;
    let first: serde_json::Value = serde_json::from_slice(&first).expect("reads the index");

    let (status, second) = call(&app, request(&body(4))).await;
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
        trickplay: TrickplayRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        media_roots: vec![PathBuf::from("/nowhere")],
    });

    let (status, _) = call(&app, request(&body(4))).await;

    assert_eq!(status, StatusCode::FORBIDDEN);
}

/// An ffmpeg that records every sheet render before running the real one.
///
/// Counting invocations is the only way to tell "the work was shared" from
/// "both runs happened to agree", and both are green under a weaker check.
///
/// Only renders are counted, recognised by `-skip_frame`, which nothing else
/// passes. The service also asks ffmpeg what it can do, and counting those
/// would make this test fail whenever something unrelated to sharing work
/// started or stopped probing.
fn counting_ffmpeg(directory: &std::path::Path) -> (String, PathBuf) {
    use std::os::unix::fs::PermissionsExt;

    std::fs::create_dir_all(directory).expect("creates the directory");

    let tally = directory.join("runs");
    let script = directory.join("ffmpeg-counting");

    std::fs::write(
        &script,
        format!(
            "#!/bin/sh\ncase \" $* \" in *\" -skip_frame \"*) echo run >> {tally} ;; esac\nexec {real} \"$@\"\n",
            tally = tally.display(),
            real = ffmpeg(),
        ),
    )
    .expect("writes the wrapper");

    std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755))
        .expect("makes the wrapper executable");

    (script.to_string_lossy().into_owned(), tally)
}

fn runs_recorded(tally: &std::path::Path) -> usize {
    std::fs::read_to_string(tally)
        .map(|text| text.lines().count())
        .unwrap_or_default()
}

#[tokio::test]
async fn asking_twice_at_once_renders_one_set_rather_than_two() {
    let root = std::env::temp_dir().join("flux-test-trickplay-concurrent");
    let _ = std::fs::remove_dir_all(&root);

    let (ffmpeg_path, tally) = counting_ffmpeg(&root.join("bin"));

    let app = create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            ffmpeg: ffmpeg_path,
            cache_root: root.clone(),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        trickplay: TrickplayRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        ffprobe: ffprobe(),
        media_roots: Vec::new(),
    });

    let (first, second) =
        tokio::join!(call(&app, request(&body(4))), call(&app, request(&body(4))));

    assert_eq!(
        first.0,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&first.1)
    );
    assert_eq!(second.0, StatusCode::OK);
    assert_eq!(
        runs_recorded(&tally),
        1,
        "ffmpeg ran more than once for one set of thumbnails"
    );

    let index: serde_json::Value = serde_json::from_slice(&first.1).expect("reads the index");
    let other: serde_json::Value = serde_json::from_slice(&second.1).expect("reads the index");

    assert_eq!(index["id"], other["id"]);
    assert_eq!(index["sheets"], other["sheets"]);
}
