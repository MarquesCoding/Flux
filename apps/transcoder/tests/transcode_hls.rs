//! End to end transcoding, against real media, through the real HTTP surface.
//!
//! Everything here runs `FFmpeg` for real and asserts on bytes it produced.
//! Unit tests can prove the argument vector is correct; only this can prove
//! the arguments actually transcode something a player could read.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::case_sensitive_file_extension_comparisons
)]

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
use flux_transcoder::transcode_plan::{
    AudioAction, HardwareAccel, SessionSpec, SubtitleAction, VideoAction,
};

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn ffprobe() -> String {
    std::env::var("FLUX_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

fn fixture_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("flux-fixtures");

    std::fs::create_dir_all(&dir).expect("creates the fixture directory");

    dir
}

/// A file long enough that it cannot be encoded inside a client's patience.
///
/// The short fixture hides an entire class of bug: ffmpeg finishes it in a
/// couple of seconds, so anything the muxer defers until exit still appears
/// before any timeout. A real film does not finish, and a manifest that only
/// lands at the end never lands at all.
fn long_source_file() -> PathBuf {
    let path = fixture_dir().join("session-source-long.mp4");

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=1280x720:rate=25",
            "-t",
            "120",
            "-c:v",
            "libx264",
            "-preset",
            "veryslow",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "50",
        ])
        .arg("-y")
        .arg(&path)
        .status()
        .expect("runs ffmpeg");

    assert!(
        status.success(),
        "ffmpeg could not generate the long source fixture"
    );

    path
}

/// A short real file with video and audio.
fn source_file() -> PathBuf {
    let path = fixture_dir().join("session-source.mp4");

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x240:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-t",
            "6",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "25",
            "-c:a",
            "aac",
            "-ac",
            "2",
        ])
        .arg("-y")
        .arg(&path)
        .status()
        .expect("runs ffmpeg");

    assert!(
        status.success(),
        "ffmpeg could not generate the source fixture"
    );

    path
}

/// A registry with its own cache directory.
///
/// Session ids are content addressed, so two tests asking for the same output
/// would otherwise share a directory and run competing ffmpeg processes into
/// it. Production has a single registry that deduplicates; tests do not.
fn registry(name: &str) -> SessionRegistry {
    SessionRegistry::new(SessionConfig {
        ffmpeg: ffmpeg(),
        cache_root: cache_root(name),
        idle_timeout: Duration::from_secs(60),
        max_concurrent: 2,
    })
}

fn cache_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("flux-test-transcodes-{name}"))
}

fn app(registry: SessionRegistry) -> axum::Router {
    create_router(AppState {
        registry,
        ffprobe: ffprobe(),
        trickplay: flux_transcoder::trickplay::TrickplayRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        media_roots: Vec::new(),
    })
}

fn spec(video: VideoAction, audio: AudioAction) -> SessionSpec {
    SessionSpec {
        input_path: source_file().to_string_lossy().into_owned(),
        start_seconds: 0,
        segment_seconds: 2,
        hardware_accel: HardwareAccel::None,
        video,
        audio,
        audio_stream_index: None,
        subtitles: SubtitleAction::None,
    }
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
        .to_bytes();

    (status, bytes.to_vec())
}

fn post_json(path: &str, body: &serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .expect("builds the request")
}

fn get(path: &str) -> Request<Body> {
    Request::builder()
        .uri(path)
        .body(Body::empty())
        .expect("builds the request")
}

async fn start(app: &axum::Router, spec: &SessionSpec) -> (StatusCode, serde_json::Value) {
    let (status, bytes) = call(
        app,
        post_json(
            "/sessions",
            &serde_json::to_value(spec).expect("serialises"),
        ),
    )
    .await;

    let body = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);

    (status, body)
}

#[tokio::test]
async fn reports_health() {
    let (status, _) = call(&app(registry("health")), get("/health")).await;

    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn probes_a_real_file_over_http() {
    let app = app(registry("probe"));
    let path = source_file().to_string_lossy().into_owned();

    let (status, bytes) = call(
        &app,
        post_json("/probe", &serde_json::json!({ "path": path })),
    )
    .await;
    let body: serde_json::Value = serde_json::from_slice(&bytes).expect("parses");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["video"]["codec"], "h264");
}

#[tokio::test]
async fn refuses_to_start_a_session_for_a_missing_file() {
    let app = app(registry("missing"));
    let missing = SessionSpec {
        input_path: "/does/not/exist.mkv".into(),
        ..spec(VideoAction::Copy, AudioAction::Copy)
    };

    let (status, _) = start(&app, &missing).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn remuxes_to_hls_without_re_encoding() {
    let app = app(registry("remux"));
    let (status, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;

    assert_eq!(status, StatusCode::OK, "body was {body}");

    let manifest = body["manifest"].as_str().expect("has a manifest path");
    let (manifest_status, manifest_bytes) = call(&app, get(manifest)).await;
    let playlist = String::from_utf8_lossy(&manifest_bytes);

    assert_eq!(manifest_status, StatusCode::OK);
    assert!(playlist.starts_with("#EXTM3U"), "playlist was {playlist}");
    assert!(
        playlist.contains("#EXT-X-MAP:URI=\"init.mp4\""),
        "expected fmp4 init"
    );
}

#[tokio::test]
async fn serves_the_segments_the_playlist_names() {
    let app = app(registry("segments"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;

    let id = body["id"].as_str().expect("has an id");
    let (_, manifest_bytes) = call(&app, get(body["manifest"].as_str().expect("manifest"))).await;
    let playlist = String::from_utf8_lossy(&manifest_bytes).into_owned();

    let segment = playlist
        .lines()
        .find(|line| line.ends_with(".m4s"))
        .expect("playlist names a segment");

    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/{segment}"))).await;

    assert_eq!(status, StatusCode::OK);
    assert!(bytes.len() > 512, "segment was {} bytes", bytes.len());
}

#[tokio::test]
async fn produces_segments_ffprobe_can_read() {
    let app = app(registry("readable"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id");

    let directory = cache_root("readable").join(id);
    let manifest = directory.join("index.m3u8");

    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
        ])
        .arg(&manifest)
        .output()
        .expect("runs ffprobe");

    let duration: f64 = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap_or(0.0);

    assert!(output.status.success(), "ffprobe rejected the playlist");
    assert!(duration > 1.0, "playlist duration was {duration}");
}

#[tokio::test]
async fn re_encodes_video_when_asked() {
    let app = app(registry("encode"));
    let encode = spec(
        VideoAction::Encode {
            encoder: "libx264".into(),
            max_bitrate_kbps: 400,
            max_width: 160,
            max_height: 120,
            tone_map: None,
        },
        AudioAction::Copy,
    );

    let (status, body) = start(&app, &encode).await;

    assert_eq!(status, StatusCode::OK, "body was {body}");

    let id = body["id"].as_str().expect("has an id");
    let manifest = cache_root("encode").join(id).join("index.m3u8");

    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
        ])
        .arg(&manifest)
        .output()
        .expect("runs ffprobe");

    // ffprobe reports the stream once per segment in an HLS playlist, so the
    // first line is the answer and the repeats are noise.
    let raw = String::from_utf8_lossy(&output.stdout);
    let dimensions = raw
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or_default()
        .trim()
        .to_owned();

    assert_eq!(dimensions, "160,120", "expected the scaled output");
}

#[tokio::test]
async fn the_same_specification_reuses_one_session() {
    let registry = registry("reuse");
    let app = app(registry.clone());
    let subject = spec(VideoAction::Copy, AudioAction::Copy);

    let (_, first) = start(&app, &subject).await;
    let (_, second) = start(&app, &subject).await;

    assert_eq!(first["id"], second["id"]);
    assert_eq!(registry.len().await, 1);
}

#[tokio::test]
async fn a_different_seek_is_a_different_session() {
    let registry = registry("seek");
    let app = app(registry.clone());

    let (_, first) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let (_, second) = start(
        &app,
        &SessionSpec {
            start_seconds: 2,
            ..spec(VideoAction::Copy, AudioAction::Copy)
        },
    )
    .await;

    assert_ne!(first["id"], second["id"]);
    assert_eq!(registry.len().await, 2);
}

#[tokio::test]
async fn stopping_a_session_forgets_it() {
    let registry = registry("stop");
    let app = app(registry.clone());
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id").to_owned();

    let request = Request::builder()
        .method("DELETE")
        .uri(format!("/sessions/{id}"))
        .body(Body::empty())
        .expect("builds the request");

    let (status, _) = call(&app, request).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(registry.is_empty().await);
}

#[tokio::test]
async fn a_heartbeat_keeps_a_session_off_the_idle_list() {
    let app = app(registry("heartbeat"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id").to_owned();

    let (status, _) = call(
        &app,
        post_json(
            &format!("/sessions/{id}/heartbeat"),
            &serde_json::json!({ "isPlaying": false }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn heartbeating_an_unknown_session_answers_not_found() {
    let app = app(registry("heartbeat-unknown"));

    let (status, _) = call(
        &app,
        post_json(
            "/sessions/does-not-exist/heartbeat",
            &serde_json::json!({ "isPlaying": true }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn refuses_to_serve_files_outside_the_session_directory() {
    let app = app(registry("traversal"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id");

    let (status, _) = call(&app, get(&format!("/sessions/{id}/..%2f..%2fetc%2fpasswd"))).await;

    assert_ne!(status, StatusCode::OK, "path traversal must not be served");
}

#[tokio::test]
async fn records_completion_only_when_ffmpeg_finishes_cleanly() {
    let app = app(registry("complete"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id");
    let marker = cache_root("complete").join(id).join(".complete");

    for _ in 0..100 {
        if marker.exists() {
            break;
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    assert!(
        marker.exists(),
        "expected a completion marker once ffmpeg finished"
    );
}

#[tokio::test]
async fn reuses_a_finished_transcode_instead_of_running_it_again() {
    let registry = registry("reuse");
    let app = app(registry.clone());
    let subject = spec(VideoAction::Copy, AudioAction::Copy);

    let (_, body) = start(&app, &subject).await;
    let id = body["id"].as_str().expect("has an id").to_owned();
    let marker = cache_root("reuse").join(&id).join(".complete");

    for _ in 0..100 {
        if marker.exists() {
            break;
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    registry.stop(&id).await;

    let before = std::fs::metadata(cache_root("reuse").join(&id).join("index.m3u8"))
        .and_then(|meta| meta.modified())
        .expect("reads the manifest time");

    let (status, again) = start(&app, &subject).await;

    let after = std::fs::metadata(cache_root("reuse").join(&id).join("index.m3u8"))
        .and_then(|meta| meta.modified())
        .expect("reads the manifest time");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(again["id"].as_str(), Some(id.as_str()));
    assert_eq!(before, after, "a finished transcode must not be rewritten");
}

#[tokio::test]
async fn reports_capabilities_over_http() {
    let (status, bytes) = call(&app(registry("caps")), get("/capabilities")).await;
    let body: serde_json::Value = serde_json::from_slice(&bytes).expect("parses");

    assert_eq!(status, StatusCode::OK);
    assert!(
        body["encoders"]
            .as_array()
            .is_some_and(|list| !list.is_empty()),
        "expected at least one verified encoder"
    );
}

#[tokio::test]
async fn serves_a_manifest_before_the_transcode_has_finished() {
    // Session directories are content addressed and outlive the process, so a
    // manifest left by an earlier run would answer this test instead of the
    // one under test.
    let _ = std::fs::remove_dir_all(cache_root("growing"));

    let app = app(registry("growing"));
    let spec = SessionSpec {
        input_path: long_source_file().to_string_lossy().into_owned(),
        segment_seconds: 4,
        video: VideoAction::Encode {
            encoder: "libx264".into(),
            max_bitrate_kbps: 6000,
            max_width: 1280,
            max_height: 720,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        ..spec(VideoAction::Copy, AudioAction::Copy)
    };

    let (status, body) = start(&app, &spec).await;

    assert_eq!(status, StatusCode::OK, "{body}");

    let id = body["id"].as_str().expect("names the session");
    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/index.m3u8"))).await;
    let manifest = String::from_utf8_lossy(&bytes);

    assert_eq!(status, StatusCode::OK);
    assert!(manifest.contains("#EXTM3U"), "{manifest}");
    // Still encoding, so the playlist must already list what exists rather
    // than waiting for the run to end.
    assert!(manifest.contains(".m4s"), "{manifest}");
    assert!(
        !manifest.contains("#EXT-X-ENDLIST"),
        "the transcode finished during the test, which proves nothing: {manifest}"
    );

    let (status, _) = call(
        &app,
        Request::builder()
            .method("DELETE")
            .uri(format!("/sessions/{id}"))
            .body(Body::empty())
            .expect("builds the request"),
    )
    .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
}
