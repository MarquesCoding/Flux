//! What a session says it found already made, against real media.
//!
//! A directory is addressed by the treatment it performs, so the same request
//! twice is answered out of what is on disk. Which of the ways that happens —
//! a finished film, a run somebody else is already holding, the segments an
//! abandoned session left — is what the caller reports to a viewer, and only a
//! session started for real can prove it is reported correctly.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

use valence_transcoder::monitor::{Journal, Monitor};
use valence_transcoder::preview::PreviewRegistry;
use valence_transcoder::queue::WorkQueue;
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::transcode_plan::{
    AudioAction, HardwareAccel, SegmentContainer, SessionSpec, SubtitleAction, VideoAction,
};

mod common;

use common::{ffmpeg, ffprobe, generate, require_ffmpeg};

/// A file short enough to finish inside a test's patience.
fn short_source() -> PathBuf {
    generate(
        "reuse-source-short.mp4",
        &[
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-t",
            "4",
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
        ],
    )
}

/// A file long enough that a run over it is still going when the test looks.
///
/// The short fixture cannot show a shared transcode: ffmpeg finishes it before
/// a second viewer can arrive, so the second one finds a finished film rather
/// than a run to join, and the case never happens.
fn long_source() -> PathBuf {
    generate(
        "reuse-source-long.mp4",
        &[
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-t",
            "300",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "25",
            "-c:a",
            "aac",
            "-ac",
            "2",
        ],
    )
}

fn cache_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("valence-test-reuse-{name}"))
}

/// A registry with a cache directory nothing else writes into.
///
/// Session ids are content addressed, so two tests asking for the same
/// treatment would otherwise share a directory and one would find the other's
/// work — which is the very thing under test, arriving from the wrong place.
fn registry(name: &str) -> SessionRegistry {
    std::fs::remove_dir_all(cache_root(name)).ok();

    SessionRegistry::new(SessionConfig {
        device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
        ffmpeg: ffmpeg(),
        ffprobe: ffprobe(),
        cache_root: cache_root(name),
        artefact_root: cache_root(name),
        idle_timeout: Duration::from_secs(60),
        manifest_timeout: std::time::Duration::from_secs(120),
        max_concurrent: 2,
    })
}

fn app(registry: SessionRegistry) -> axum::Router {
    create_router(AppState {
        registry,
        ffprobe: ffprobe(),
        downloads: valence_transcoder::download::DownloadRegistry::new(),
        trickplay: valence_transcoder::trickplay::TrickplayRegistry::default(),
        previews: PreviewRegistry::default(),
        monitor: Monitor::new(Journal::new()),
        queue: WorkQueue::new(1),
        media_roots: Vec::new(),
    })
}

fn spec(input: &std::path::Path) -> SessionSpec {
    SessionSpec {
        input_path: input.to_string_lossy().into_owned(),
        start_seconds: 0,
        segment_seconds: 2,
        hardware_accel: HardwareAccel::None,
        video: VideoAction::Encode {
            encoder: "libx264".to_owned(),
            max_bitrate_kbps: 1_000,
            max_width: 320,
            max_height: 180,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        audio_stream_index: None,
        subtitles: SubtitleAction::None,
        source_size: None,
        container: SegmentContainer::Fmp4,
        source_video_codec: None,
    }
}

async fn call(app: &axum::Router, request: Request<Body>) -> (StatusCode, serde_json::Value) {
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

    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null),
    )
}

async fn start(app: &axum::Router, spec: &SessionSpec) -> serde_json::Value {
    start_as(app, spec, None).await
}

/// Starts a session as a named device, the way the server does for a real tab.
async fn start_as(
    app: &axum::Router,
    spec: &SessionSpec,
    device: Option<&str>,
) -> serde_json::Value {
    let mut payload = serde_json::to_value(spec).expect("serialises");

    if let (Some(device), Some(object)) = (device, payload.as_object_mut()) {
        object.insert("deviceId".to_owned(), serde_json::json!(device));
    }

    let (status, body) = call(
        app,
        Request::builder()
            .method("POST")
            .uri("/sessions")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .expect("builds the request"),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "the session did not start: {body}");

    body
}

async fn stop(app: &axum::Router, id: &str) {
    stop_as(app, id, None).await;
}

/// Stops a hold as a named device, the way a tab closing does.
async fn stop_as(app: &axum::Router, id: &str, device: Option<&str>) {
    let asked = device.map_or_else(String::new, |device| format!("?deviceId={device}"));

    let (status, _) = call(
        app,
        Request::builder()
            .method("DELETE")
            .uri(format!("/sessions/{id}{asked}"))
            .body(Body::empty())
            .expect("builds the request"),
    )
    .await;

    assert_eq!(status, StatusCode::NO_CONTENT);
}

/// What a session said it found.
fn reuse(body: &serde_json::Value) -> &str {
    body["reuse"]
        .as_str()
        .expect("a session says what it found")
}

/// Waits for a file to appear, so a test reads a directory in a known state
/// rather than whichever one it happened to catch.
async fn wait_for(path: &std::path::Path, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    loop {
        if path.exists() {
            return true;
        }

        if Instant::now() >= deadline {
            return false;
        }

        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn says_nothing_was_reused_the_first_time_a_treatment_is_asked_for() {
    require_ffmpeg();

    let app = app(registry("first"));

    assert_eq!(reuse(&start(&app, &spec(&short_source())).await), "none");
}

#[tokio::test(flavor = "multi_thread")]
async fn says_the_whole_transcode_was_reused_once_it_has_been_finished() {
    require_ffmpeg();

    let root = cache_root("finished");
    let app = app(registry("finished"));
    let spec = spec(&short_source());

    let first = start(&app, &spec).await;
    let id = first["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();

    assert!(
        wait_for(&root.join(&id).join(".complete"), Duration::from_secs(60)).await,
        "the transcode never finished, so there is nothing to reuse"
    );

    stop(&app, &id).await;

    let second = start(&app, &spec).await;

    assert_eq!(reuse(&second), "whole");
    assert_eq!(
        second["id"].as_str(),
        Some(id.as_str()),
        "the same treatment must land on the same directory"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn says_a_transcode_is_shared_where_somebody_else_is_already_running_it() {
    require_ffmpeg();

    let app = app(registry("shared"));
    let spec = spec(&long_source());

    let first = start_as(&app, &spec, Some("tab-1")).await;
    let second = start_as(&app, &spec, Some("tab-2")).await;

    assert_eq!(reuse(&first), "none");
    assert_eq!(reuse(&second), "shared");
    assert_eq!(
        first["id"], second["id"],
        "two viewers of one treatment share one transcode"
    );
}

/// A player asks for its stream twice as it opens one, and both answers reach
/// a viewer: the second is what the player keeps, the first is what the server
/// tells an operator. Answering them differently put "shared with another
/// viewer" on the statistics panel and "being made now" on the sessions page
/// for one person watching one film on their own.
#[tokio::test(flavor = "multi_thread")]
async fn tells_one_viewer_asking_twice_the_same_thing_both_times() {
    require_ffmpeg();

    let app = app(registry("asked-twice"));
    let spec = spec(&long_source());

    let first = start_as(&app, &spec, Some("tab-1")).await;
    let second = start_as(&app, &spec, Some("tab-1")).await;

    assert_eq!(first["id"], second["id"]);
    assert_eq!(
        reuse(&second),
        reuse(&first),
        "one viewer's two requests must not disagree about what was reused"
    );
    assert_eq!(
        reuse(&second),
        "none",
        "a viewer's own second request is not somebody else's transcode"
    );
}

/// The same, for a viewer who is genuinely alone but whose player asks twice
/// against a directory that was already finished.
#[tokio::test(flavor = "multi_thread")]
async fn tells_one_viewer_asking_twice_the_same_thing_over_a_finished_transcode() {
    require_ffmpeg();

    let root = cache_root("asked-twice-finished");
    let app = app(registry("asked-twice-finished"));
    let spec = spec(&short_source());

    let first = start_as(&app, &spec, Some("tab-1")).await;
    let id = first["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();

    assert!(
        wait_for(&root.join(&id).join(".complete"), Duration::from_secs(60)).await,
        "the transcode never finished, so there is nothing to reuse"
    );

    let second = start_as(&app, &spec, Some("tab-1")).await;

    assert_eq!(reuse(&second), "whole");
}

#[tokio::test(flavor = "multi_thread")]
async fn says_part_of_a_transcode_was_reused_where_a_session_was_abandoned() {
    require_ffmpeg();

    let root = cache_root("abandoned");
    let app = app(registry("abandoned"));
    let spec = spec(&long_source());

    let first = start(&app, &spec).await;
    let id = first["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();

    assert!(
        wait_for(
            &root.join(&id).join("segment00002.m4s"),
            Duration::from_secs(60)
        )
        .await,
        "nothing was written, so there is nothing to find later"
    );

    stop(&app, &id).await;

    let second = start(&app, &spec).await;

    assert_eq!(
        reuse(&second),
        "partial",
        "a directory with segments and no marker is a session somebody left"
    );
}

/// The point of reporting a part-finished directory: the run resumes rather
/// than encoding what is already there a second time. Proven by the file
/// itself — a segment an earlier run finished must still be the same bytes,
/// written at the same moment, once the next session has started over it. The
/// wait is long enough that a run started at the beginning would have reached
/// that segment and rewritten it.
#[tokio::test(flavor = "multi_thread")]
async fn does_not_encode_again_what_an_abandoned_run_already_finished() {
    require_ffmpeg();

    let root = cache_root("resumed");
    let app = app(registry("resumed"));
    let spec = spec(&long_source());

    let first = start(&app, &spec).await;
    let id = first["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();
    let directory = root.join(&id);

    assert!(
        wait_for(&directory.join("segment00003.m4s"), Duration::from_secs(60)).await,
        "the run wrote too little to leave anything worth resuming"
    );

    stop(&app, &id).await;

    let finished = directory.join("segment00000.m4s");
    let before = std::fs::metadata(&finished)
        .and_then(|found| found.modified())
        .expect("the segment can be read");

    start(&app, &spec).await;

    tokio::time::sleep(Duration::from_secs(3)).await;

    let after = std::fs::metadata(&finished)
        .and_then(|found| found.modified())
        .expect("the segment is still there");

    assert_eq!(
        before, after,
        "a segment an earlier run finished was encoded a second time"
    );
}

/// A viewer who left is not somebody the next one is sharing with.
///
/// Two tabs watch the same thing, the first closes, and a third arrives. It is
/// sharing with the second and not with the first, and the only thing that can
/// tell those apart is the device each of them named on the way out. A tab
/// lets go as many times as it took hold, since a player opens a stream twice.
#[tokio::test(flavor = "multi_thread")]
async fn stops_counting_a_viewer_who_has_gone_as_somebody_to_share_with() {
    require_ffmpeg();

    let app = app(registry("left"));
    let spec = spec(&long_source());

    start_as(&app, &spec, Some("tab-1")).await;
    let id = start_as(&app, &spec, Some("tab-1")).await["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();

    let second = start_as(&app, &spec, Some("tab-2")).await;
    assert_eq!(reuse(&second), "shared", "two tabs are two viewers");

    stop_as(&app, &id, Some("tab-1")).await;
    stop_as(&app, &id, Some("tab-1")).await;

    let rejoined = start_as(&app, &spec, Some("tab-1")).await;

    assert_eq!(
        reuse(&rejoined),
        "shared",
        "the second tab is still watching, so this is genuinely shared"
    );

    stop_as(&app, &id, Some("tab-2")).await;
    stop_as(&app, &id, Some("tab-1")).await;

    let alone = start_as(&app, &spec, Some("tab-3")).await;

    assert_ne!(
        reuse(&alone),
        "shared",
        "everybody who was watching has gone, so there is nobody to share with"
    );
}

/// The second viewer's player asks twice as well.
///
/// The first viewer's two requests were made to agree; the second viewer's
/// were not, because by its second request it is holding the session itself
/// and read its own presence as "not a new viewer". One person watching
/// alongside another was told `shared` once and `none` once.
#[tokio::test(flavor = "multi_thread")]
async fn tells_a_sharing_viewer_asking_twice_the_same_thing_both_times() {
    require_ffmpeg();

    let app = app(registry("shared-twice"));
    let spec = spec(&long_source());

    start_as(&app, &spec, Some("tab-1")).await;

    let first = start_as(&app, &spec, Some("tab-2")).await;
    let second = start_as(&app, &spec, Some("tab-2")).await;

    assert_eq!(
        reuse(&second),
        reuse(&first),
        "one viewer's two requests must not disagree about what was reused"
    );
    assert_eq!(
        reuse(&second),
        "shared",
        "somebody else is watching, on both of this viewer's requests"
    );
}

/// Segments somewhere else in the film are not a resumed session.
///
/// A directory holding another viewer's twenty-minute mark has segments on it,
/// and somebody starting from the beginning skips none of them. Reporting that
/// as resumed promises saved work to an operator whose encoder is about to do
/// the whole film.
#[tokio::test(flavor = "multi_thread")]
async fn does_not_call_it_resumed_where_the_run_starts_where_it_would_have() {
    require_ffmpeg();

    let root = cache_root("elsewhere");
    let app = app(registry("elsewhere"));
    let spec = spec(&long_source());

    let started = start(&app, &spec).await;
    let id = started["id"]
        .as_str()
        .expect("a session has an id")
        .to_owned();
    let directory = root.join(&id);

    assert!(
        wait_for(&directory.join("segment00002.m4s"), Duration::from_secs(60)).await,
        "the run wrote nothing to leave behind"
    );

    stop(&app, &id).await;

    for index in 0..3 {
        std::fs::remove_file(directory.join(format!("segment{index:05}.m4s")))
            .expect("the opening segments can be taken away");
    }

    std::fs::write(directory.join("segment00200.m4s"), b"somebody else's mark")
        .expect("a segment further into the film is written");

    let again = start(&app, &spec).await;

    assert_eq!(
        reuse(&again),
        "none",
        "nothing was skipped, so nothing was reused"
    );
}
