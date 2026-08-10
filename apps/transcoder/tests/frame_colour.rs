//! Colour sampling, against real files, through the real HTTP surface.
//!
//! The unit tests prove the weighting picks a vivid subject out of a dull
//! frame. Only running ffmpeg proves the decode produces pixels in the order
//! and format that weighting assumes.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use flux_transcoder::router::{create_router, AppState};
use flux_transcoder::session::{SessionConfig, SessionRegistry};
use flux_transcoder::trickplay::TrickplayRegistry;

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn ffprobe() -> String {
    std::env::var("FLUX_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

fn fixture_dir() -> PathBuf {
    let directory = std::env::temp_dir().join("flux-fixtures");

    std::fs::create_dir_all(&directory).expect("creates the fixture directory");

    directory
}

/// A clip of one flat colour, which is the only frame whose answer is known.
fn coloured_clip(name: &str, colour: &str, seconds: u32) -> PathBuf {
    let path = fixture_dir().join(name);

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            &format!("color=c={colour}:size=320x240:rate=10:duration={seconds}"),
        ])
        .args(["-c:v", "libx264", "-pix_fmt", "yuv420p"])
        .arg("-y")
        .arg(&path)
        .status()
        .expect("runs ffmpeg");

    assert!(status.success(), "could not generate {name}");

    path
}

fn app() -> axum::Router {
    create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            ffmpeg: ffmpeg(),
            cache_root: std::env::temp_dir().join("flux-test-colour"),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        trickplay: TrickplayRegistry::default(),
        ffprobe: ffprobe(),
        media_roots: Vec::new(),
    })
}

async fn colour_of(app: &axum::Router, path: &Path, duration_seconds: f64) -> serde_json::Value {
    let body = serde_json::json!({
        "inputPath": path.to_string_lossy(),
        "durationSeconds": duration_seconds,
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/colour")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("builds the request"),
        )
        .await
        .expect("handles the request");

    assert_eq!(response.status(), StatusCode::OK);

    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("reads the body")
        .to_bytes();

    serde_json::from_slice(&bytes).expect("reads the colour")
}

#[tokio::test]
async fn reads_the_colour_of_a_real_frame() {
    let clip = coloured_clip("colour-blue.mp4", "0x2040c0", 8);
    let found = colour_of(&app(), &clip, 8.0).await;

    let red = found["red"].as_u64().unwrap_or(0);
    let blue = found["blue"].as_u64().unwrap_or(0);

    assert!(blue > red + 40, "expected a blue frame, got {found}");
    assert!(found["hex"].as_str().unwrap_or("").starts_with('#'));
}

#[tokio::test]
async fn tells_two_differently_coloured_films_apart() {
    let app = app();

    let blue = colour_of(&app, &coloured_clip("colour-blue.mp4", "0x2040c0", 8), 8.0).await;
    let red = colour_of(&app, &coloured_clip("colour-red.mp4", "0xc02020", 8), 8.0).await;

    assert_ne!(blue["hex"], red["hex"]);
    assert!(red["red"].as_u64().unwrap_or(0) > blue["red"].as_u64().unwrap_or(0));
}

#[tokio::test]
async fn still_finds_a_colour_when_the_length_was_overstated() {
    // A file shorter than it claims would otherwise be asked for a frame past
    // its end, and answer with nothing at all.
    let clip = coloured_clip("colour-short.mp4", "0x20a040", 2);
    let found = colour_of(&app(), &clip, 600.0).await;

    let green = found["green"].as_u64().unwrap_or(0);

    assert!(green > found["red"].as_u64().unwrap_or(0), "{found}");
}
