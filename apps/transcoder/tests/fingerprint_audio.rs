//! Fingerprinting, against real audio, through the real HTTP surface.
//!
//! Unit tests prove the maths on synthetic tones. Only running ffmpeg proves
//! the decode and the maths agree on a real file, and that the same theme in
//! two different encodes still fingerprints alike — which is the whole
//! property intro detection rests on.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use valence_transcoder::monitor::{Journal, Monitor};
use valence_transcoder::preview::PreviewRegistry;
use valence_transcoder::queue::WorkQueue;
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::trickplay::TrickplayRegistry;

mod common;

use common::{building_name, ffmpeg, ffprobe, fixture_dir};

/// An "episode": a common opening followed by its own content.
///
/// The opening is broadband noise from a fixed seed, so both files are encoded
/// from an identical master and differ only in how they were encoded — which
/// is the situation intro detection actually faces. A pure tone would be a
/// kinder fixture and a useless one: a steady spectrum has no frame-to-frame
/// change to measure, so the hash of it is noise in both files.
fn episode(name: &str, filler_seed: u32, bitrate: &str) -> PathBuf {
    let path = fixture_dir().join(name);
    let building = fixture_dir().join(building_name(name));

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            "anoisesrc=color=pink:seed=7:duration=8:sample_rate=48000",
        ])
        .args([
            "-f",
            "lavfi",
            "-i",
            &format!("anoisesrc=color=brown:seed={filler_seed}:duration=8:sample_rate=48000"),
        ])
        .args(["-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]"])
        .args(["-map", "[out]", "-b:a", bitrate])
        .arg("-y")
        .arg(&building)
        .status()
        .expect("runs ffmpeg");

    assert!(status.success(), "could not generate {name}");

    std::fs::rename(&building, &path).expect("moves the finished fixture into place");

    path
}

fn app() -> axum::Router {
    create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
            ffmpeg: ffmpeg(),
            ffprobe: ffprobe(),
            cache_root: std::env::temp_dir().join("valence-test-fingerprint"),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        trickplay: TrickplayRegistry::default(),
        previews: PreviewRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        ffprobe: ffprobe(),
        media_roots: Vec::new(),
    })
}

async fn hashes(app: &axum::Router, path: &std::path::Path) -> Vec<u32> {
    let body = serde_json::json!({
        "inputPath": path.to_string_lossy(),
        "startSeconds": 0,
        "durationSeconds": 16,
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/fingerprint")
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

    let parsed: serde_json::Value = serde_json::from_slice(&bytes).expect("reads the fingerprint");

    parsed["hashes"]
        .as_array()
        .expect("carries hashes")
        .iter()
        .filter_map(|value| value.as_u64().and_then(|hash| u32::try_from(hash).ok()))
        .collect()
}

fn bits_differing(left: u32, right: u32) -> u32 {
    (left ^ right).count_ones()
}

#[tokio::test]
async fn fingerprints_a_real_file() {
    let app = app();
    let prints = hashes(&app, &episode("fp-one.m4a", 11, "128k")).await;

    assert!(prints.len() > 100, "got {} hashes", prints.len());
}

#[tokio::test]
async fn two_encodes_of_the_same_theme_fingerprint_alike() {
    let app = app();

    let first = hashes(&app, &episode("fp-one.m4a", 11, "128k")).await;
    let second = hashes(&app, &episode("fp-two.m4a", 23, "96k")).await;

    let theme_frames = 60;
    let close = (0..theme_frames)
        .filter(|index| {
            bits_differing(
                *first.get(*index).unwrap_or(&0),
                *second.get(*index).unwrap_or(&0),
            ) <= 6
        })
        .count();

    assert!(
        close > theme_frames / 2,
        "only {close} of {theme_frames} opening frames matched"
    );
}

#[tokio::test]
async fn refuses_a_file_outside_the_media_roots() {
    let app = create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
            ffmpeg: ffmpeg(),
            ffprobe: ffprobe(),
            cache_root: std::env::temp_dir().join("valence-test-fingerprint-confined"),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        trickplay: TrickplayRegistry::default(),
        previews: PreviewRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        ffprobe: ffprobe(),
        media_roots: vec![PathBuf::from("/nowhere")],
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/fingerprint")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({"inputPath": "/etc/passwd", "durationSeconds": 10})
                        .to_string(),
                ))
                .expect("builds the request"),
        )
        .await
        .expect("handles the request");

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
