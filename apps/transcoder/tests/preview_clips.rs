//! Preview clips, against real media, through the real HTTP surface.
//!
//! The unit tests prove the arguments are what Valence meant to write. Only
//! running two requests at once proves the registry stops them writing the
//! same file.

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

use common::{building_name, ffmpeg, ffprobe};

/// A file long enough for a clip to be cut out of the middle of it.
fn source_file() -> PathBuf {
    let directory = std::env::temp_dir().join("valence-fixtures");

    std::fs::create_dir_all(&directory).expect("creates the fixture directory");

    let path = directory.join("preview-source.mp4");
    let building = directory.join(building_name("preview-source.mp4"));

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args([
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=640x360:rate=24:duration=60",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=60",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
        ])
        .arg(&building)
        .status()
        .expect("runs ffmpeg to build the fixture");

    assert!(status.success(), "the fixture did not render");

    std::fs::rename(&building, &path).expect("moves the finished fixture into place");

    path
}

/// An ffmpeg that records every clip it is asked to render.
///
/// Counts an encode that writes `preview.mp4`, which needs both halves of the
/// pattern. Capability detection probes every encoder the build has, each with
/// its own `-c:v`, so `-c:v` alone counts the probe. And a finished render is
/// decoded again to verify it, naming the same file, so the filename alone
/// counts one render as two.
fn counting_ffmpeg(directory: &std::path::Path) -> (String, PathBuf) {
    use std::os::unix::fs::PermissionsExt;

    std::fs::create_dir_all(directory).expect("creates the directory");

    let tally = directory.join("runs");
    let script = directory.join("ffmpeg-counting");

    std::fs::write(
        &script,
        format!(
            "#!/bin/sh\ncase \" $* \" in *\" -c:v \"*preview.mp4*) echo run >> {tally} ;; esac\nexec {real} \"$@\"\n",
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

fn body(path: &std::path::Path) -> String {
    format!(
        "{{\"inputPath\":{path:?},\"generation\":0,\"wait\":true}}",
        path = path.to_string_lossy(),
    )
}

fn request(payload: &str) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/previews")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_owned()))
        .expect("builds the request")
}

async fn call(app: &axum::Router, message: Request<Body>) -> (StatusCode, Vec<u8>) {
    let response = app
        .clone()
        .oneshot(message)
        .await
        .expect("calls the router");
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("reads the body")
        .to_bytes();

    (status, bytes.to_vec())
}

/// Two callers asking for the same clip at once must produce one render.
///
/// Before the registry they produced two, into the same `preview.mp4`, and
/// `-y` truncated it under whichever was still writing. Both then failed to
/// verify, nothing was marked complete, and the item was rendered again. This
/// is the regression test for VAL-104.
#[tokio::test]
async fn asking_twice_at_once_renders_one_clip_rather_than_two() {
    let root = std::env::temp_dir().join("valence-test-preview-concurrent");
    let _ = std::fs::remove_dir_all(&root);

    let source = source_file();
    let (ffmpeg_path, tally) = counting_ffmpeg(&root.join("bin"));

    let app = create_router(AppState {
        registry: SessionRegistry::new(SessionConfig {
            device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
            ffmpeg: ffmpeg_path,
            ffprobe: ffprobe(),
            cache_root: root.clone(),
            idle_timeout: Duration::from_secs(60),
            max_concurrent: 2,
        }),
        downloads: valence_transcoder::download::DownloadRegistry::new(),
        trickplay: TrickplayRegistry::default(),
        previews: PreviewRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(2),
        ffprobe: ffprobe(),
        media_roots: vec![source.parent().expect("a parent").to_path_buf()],
    });

    let payload = body(&source);
    let (first, second) =
        tokio::join!(call(&app, request(&payload)), call(&app, request(&payload)));

    assert_eq!(
        first.0,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&first.1)
    );
    assert_eq!(
        second.0,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&second.1)
    );

    let one: serde_json::Value = serde_json::from_slice(&first.1).expect("reads the clip");
    let other: serde_json::Value = serde_json::from_slice(&second.1).expect("reads the clip");

    assert_eq!(one["id"], other["id"], "one clip, asked for twice");
    assert_eq!(one["isReady"], true);
    assert_eq!(other["isReady"], true);

    assert_eq!(
        runs_recorded(&tally),
        1,
        "ffmpeg encoded more than once for one clip"
    );
}
