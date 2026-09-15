//! Byte ranges over the files the service hands back.
//!
//! A preview is played by a bare video element, and a video element seeks with
//! `Range` requests. Answering one with the whole file makes every scrub a fresh
//! download, and previously meant the file was read into memory in full before a
//! byte of it reached anybody.
//!
//! Needs no ffmpeg: what is being tested is delivery, so the bytes on disk can be
//! anything.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::time::Duration;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use valence_transcoder::monitor::{Journal, Monitor};
use valence_transcoder::preview::PreviewRegistry;
use valence_transcoder::queue::WorkQueue;
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::trickplay::TrickplayRegistry;

mod common;

use common::{ffmpeg, ffprobe};

/// What the fixture clip contains, so a slice of it is recognisable.
const CONTENT: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";

const PREVIEW_ID: &str = "ranged";

fn cache_root(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("valence-test-ranged-{name}"))
}

fn app(name: &str) -> axum::Router {
    let root = cache_root(name);
    let directory = root.join("previews").join(PREVIEW_ID);

    std::fs::create_dir_all(&directory).expect("creates the preview directory");
    std::fs::write(directory.join("preview.mp4"), CONTENT).expect("writes the clip");

    create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
            ffmpeg: ffmpeg(),
            ffprobe: ffprobe(),
            cache_root: root.clone(),
            artefact_root: root,
            idle_timeout: Duration::from_secs(60),
            manifest_timeout: std::time::Duration::from_secs(120),
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

async fn fetch(
    name: &str,
    range: Option<&str>,
) -> (StatusCode, Vec<u8>, Option<String>, Option<String>) {
    let mut builder = Request::builder().uri(format!("/previews/{PREVIEW_ID}/preview.mp4"));

    if let Some(value) = range {
        builder = builder.header(header::RANGE, value);
    }

    let response = app(name)
        .oneshot(builder.body(Body::empty()).expect("builds the request"))
        .await
        .expect("handles the request");

    let status = response.status();

    let content_range = response
        .headers()
        .get(header::CONTENT_RANGE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    let content_length = response
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("reads the body")
        .to_bytes()
        .to_vec();

    (status, bytes, content_range, content_length)
}

#[tokio::test]
async fn sends_the_whole_clip_when_nothing_is_asked_for() {
    let (status, bytes, content_range, content_length) = fetch("whole", None).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(bytes, CONTENT);
    assert_eq!(content_range, None);
    assert_eq!(content_length, Some(CONTENT.len().to_string()));
}

#[tokio::test]
async fn answers_a_range_with_only_those_bytes() {
    let (status, bytes, content_range, content_length) = fetch("head", Some("bytes=0-3")).await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes, b"0123");
    assert_eq!(content_range, Some(format!("bytes 0-3/{}", CONTENT.len())));
    assert_eq!(
        content_length.as_deref(),
        Some("4"),
        "a range that says it is four bytes must not send the whole clip"
    );
}

#[tokio::test]
async fn answers_an_open_ended_range_with_the_rest_of_the_clip() {
    let (status, bytes, content_range, _) = fetch("tail", Some("bytes=30-")).await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes, b"uvwxyz");
    assert_eq!(
        content_range,
        Some(format!("bytes 30-{}/{}", CONTENT.len() - 1, CONTENT.len()))
    );
}

#[tokio::test]
async fn reads_from_the_middle_without_sending_what_came_before() {
    let (status, bytes, _, _) = fetch("middle", Some("bytes=10-14")).await;

    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes, b"abcde");
}

#[tokio::test]
async fn says_ranges_are_welcome_either_way() {
    for range in [None, Some("bytes=0-3")] {
        let response = app("welcome")
            .oneshot({
                let mut builder =
                    Request::builder().uri(format!("/previews/{PREVIEW_ID}/preview.mp4"));

                if let Some(value) = range {
                    builder = builder.header(header::RANGE, value);
                }

                builder.body(Body::empty()).expect("builds the request")
            })
            .await
            .expect("handles the request");

        assert_eq!(
            response
                .headers()
                .get(header::ACCEPT_RANGES)
                .and_then(|value| value.to_str().ok()),
            Some("bytes"),
            "a player that cannot see accept-ranges will not try to seek"
        );
    }
}

#[tokio::test]
async fn refuses_a_name_that_climbs_out_of_the_directory() {
    let response = app("escape")
        .oneshot(
            Request::builder()
                .uri("/previews/ranged/..%2F..%2Fsecret")
                .body(Body::empty())
                .expect("builds the request"),
        )
        .await
        .expect("handles the request");

    assert_ne!(response.status(), StatusCode::OK);
}
