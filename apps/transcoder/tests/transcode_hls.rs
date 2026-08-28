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

use valence_transcoder::monitor::{Journal, Monitor};
use valence_transcoder::preview::PreviewRegistry;
use valence_transcoder::queue::WorkQueue;
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::transcode_plan::{
    AudioAction, HardwareAccel, SegmentContainer, SessionSpec, SubtitleAction, VideoAction,
};

mod common;

use common::{building_name, ffmpeg, ffprobe, fixture_dir};

/// A file long enough that it cannot be encoded inside a client's patience.
///
/// The short fixture hides an entire class of bug: ffmpeg finishes it in a
/// couple of seconds, so anything the muxer defers until exit still appears
/// before any timeout. A real film does not finish, and a manifest that only
/// lands at the end never lands at all.
fn long_source_file() -> PathBuf {
    let path = fixture_dir().join("session-source-long.mp4");
    let building = fixture_dir().join(building_name("session-source-long.mp4"));

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
        .arg(&building)
        .status()
        .expect("runs ffmpeg");

    assert!(
        status.success(),
        "ffmpeg could not generate the long source fixture"
    );

    std::fs::rename(&building, &path).expect("moves the finished fixture into place");

    path
}

/// A short real file with video and audio.
fn source_file() -> PathBuf {
    let path = fixture_dir().join("session-source.mp4");
    let building = fixture_dir().join(building_name("session-source.mp4"));

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
        .arg(&building)
        .status()
        .expect("runs ffmpeg");

    assert!(
        status.success(),
        "ffmpeg could not generate the source fixture"
    );

    std::fs::rename(&building, &path).expect("moves the finished fixture into place");

    path
}

/// A registry with its own cache directory.
///
/// Session ids are content addressed, so two tests asking for the same output
/// would otherwise share a directory and run competing ffmpeg processes into
/// it. Production has a single registry that deduplicates; tests do not.
fn registry(name: &str) -> SessionRegistry {
    SessionRegistry::new(SessionConfig {
        device: valence_transcoder::transcode_plan::DEFAULT_DEVICE.to_owned(),
        ffmpeg: ffmpeg(),
        ffprobe: ffprobe(),
        cache_root: cache_root(name),
        idle_timeout: Duration::from_secs(60),
        max_concurrent: 2,
    })
}

fn cache_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("valence-test-transcodes-{name}"))
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
        source_size: None,
        container: SegmentContainer::Fmp4,
        source_video_codec: None,
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
        "a fragmented playlist has to name its initialisation segment: {playlist}"
    );

    let id = body["id"].as_str().expect("has an id");
    let (init_status, init_bytes) = call(&app, get(&format!("/sessions/{id}/init.mp4"))).await;

    assert_eq!(
        init_status,
        StatusCode::OK,
        "the segment the playlist points at has to be servable"
    );
    assert!(
        init_bytes.len() > 512,
        "initialisation segment was {} bytes",
        init_bytes.len()
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

/// Every second the muxer wrote is offered exactly once.
///
/// The playlist offers groups of the muxer's segments rather than the segments
/// themselves, so that a hard cut leaving two keyframes a couple of frames
/// apart does not cost a request for a scrap of film. Grouping must lose
/// nothing and repeat nothing: what the player is served across the whole
/// playlist has to be every byte the muxer produced, in order. Counting the
/// bytes is what proves it, because a group served short or served twice moves
/// the total either way.
#[tokio::test]
async fn serves_every_byte_the_muxer_wrote_across_the_whole_playlist() {
    let app = app(registry("grouped"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;

    let id = body["id"].as_str().expect("has an id");
    let (_, manifest_bytes) = call(&app, get(body["manifest"].as_str().expect("manifest"))).await;
    let playlist = String::from_utf8_lossy(&manifest_bytes).into_owned();

    let named: Vec<&str> = playlist
        .lines()
        .filter(|line| line.ends_with(".m4s") && !line.starts_with('#'))
        .collect();

    assert!(!named.is_empty(), "playlist names no segments");

    let mut served = 0_usize;

    for segment in &named {
        let (status, bytes) = call(&app, get(&format!("/sessions/{id}/{segment}"))).await;

        assert_eq!(status, StatusCode::OK, "{segment} was not served");
        assert!(!bytes.is_empty(), "{segment} was empty");

        served += bytes.len();
    }

    let directory = cache_root("grouped").join(id);

    let mut written = 0_usize;
    let mut entries = tokio::fs::read_dir(&directory)
        .await
        .expect("reads the run");

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.starts_with("segment") && name.ends_with(".m4s") {
            written += usize::try_from(entry.metadata().await.expect("reads it").len())
                .unwrap_or_default();
        }
    }

    assert_eq!(
        served, written,
        "the playlist did not offer the film exactly once"
    );
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

/// Where somebody joined is not what they are watching.
///
/// Two viewers of one film share its segments however differently they came to
/// it, which is the whole point of addressing the work by the plan. Keying it
/// on where playback began is what made a seek a second transcode of the rest
/// of the film. See ADR-0011.
#[tokio::test]
async fn a_different_seek_joins_the_same_session() {
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

    assert_eq!(first["id"], second["id"]);
    assert_eq!(registry.len().await, 1);
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

/// Two viewers pressing play together must not start two transcodes.
///
/// Working out where a film can be cut takes a moment, and the session only
/// exists once that is done — so both requests found nothing, both started a
/// run, and two ffmpegs wrote over each other's segments in one directory. A
/// player opens a stream by asking twice on its own, so this was every play
/// rather than a rare collision.
#[tokio::test]
async fn starts_one_transcode_when_two_viewers_ask_at_once() {
    let _ = std::fs::remove_dir_all(cache_root("together"));

    let registry = registry("together");
    let app = app(registry.clone());
    let subject = spec(VideoAction::Copy, AudioAction::Copy);

    let (first, second) = tokio::join!(start(&app, &subject), start(&app, &subject));

    assert_eq!(first.0, StatusCode::OK, "{}", first.1);
    assert_eq!(second.0, StatusCode::OK, "{}", second.1);
    assert_eq!(first.1["id"], second.1["id"]);

    let id = first.1["id"].as_str().expect("has an id").to_owned();
    let leave = Request::builder()
        .method("DELETE")
        .uri(format!("/sessions/{id}"))
        .body(Body::empty())
        .expect("builds the request");

    call(&app, leave).await;

    assert_eq!(
        registry.len().await,
        1,
        "the second request joined the first rather than replacing it, so one \
         of them leaving leaves the other watching"
    );
}

/// Scrubbing must not leave two requests fighting over the transcode.
///
/// A request that has been abandoned — the viewer scrubbed on, but its wait
/// has not run out — used to drag the run back to itself on every poll, while
/// the live request dragged it forward. Measured in one scrubbing session:
/// 1750 runs, the last dozen alternating between segment 355 and segment 570,
/// and both requests refused in the end.
///
/// The newest asker steers. The older one takes what it can get.
#[tokio::test]
async fn answers_the_newest_request_when_a_viewer_scrubs_past_an_older_one() {
    let _ = std::fs::remove_dir_all(cache_root("scrubbing"));

    let app = app(registry("scrubbing"));
    let subject = SessionSpec {
        input_path: long_source_file().to_string_lossy().into_owned(),
        segment_seconds: 4,
        video: VideoAction::Encode {
            encoder: "libx264".into(),
            max_bitrate_kbps: 2000,
            max_width: 640,
            max_height: 360,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        ..spec(VideoAction::Copy, AudioAction::Copy)
    };

    let (status, body) = start(&app, &subject).await;

    assert_eq!(status, StatusCode::OK, "{body}");

    let id = body["id"].as_str().expect("names the session").to_owned();

    let far = call(&app, get(&format!("/sessions/{id}/segment00028.m4s")));
    let near = call(&app, get(&format!("/sessions/{id}/segment00004.m4s")));

    let (far, near) = tokio::join!(far, near);

    assert_eq!(
        near.0,
        StatusCode::OK,
        "the newest request is the one answered"
    );
    assert!(near.1.len() > 512, "segment was {} bytes", near.1.len());

    let started = std::fs::read_to_string(cache_root("scrubbing").join(&id).join("run.m3u8"))
        .unwrap_or_default();

    assert!(
        started.contains("segment00004.m4s"),
        "the run should be where the newest request is, not where the older one was: {started}"
    );

    let _ = far;
}

/// A viewer waiting for a segment must be able to un-pause the transcode.
///
/// The throttle stops a run that is further ahead than anyone is watching, and
/// it reads how far the viewer has got from the segments served. So a viewer
/// asking for a segment beyond a paused run waited for a process only a served
/// segment could restart, and only that segment could serve. Measured against
/// the running service: a run restarted at segment 397 produced to 435, paused,
/// and the request for 439 was refused thirty seconds later.
#[tokio::test]
async fn serves_a_segment_beyond_a_transcode_that_has_run_ahead() {
    let _ = std::fs::remove_dir_all(cache_root("throttled"));

    let app = app(registry("throttled"));
    let subject = SessionSpec {
        input_path: long_source_file().to_string_lossy().into_owned(),
        segment_seconds: 4,
        video: VideoAction::Encode {
            encoder: "libx264".into(),
            max_bitrate_kbps: 2000,
            max_width: 640,
            max_height: 360,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        ..spec(VideoAction::Copy, AudioAction::Copy)
    };

    let (status, body) = start(&app, &subject).await;

    assert_eq!(status, StatusCode::OK, "{body}");

    let id = body["id"].as_str().expect("names the session").to_owned();
    let directory = cache_root("throttled").join(&id);

    for _ in 0..600 {
        let ahead = std::fs::read_dir(&directory).map_or(0, |entries| {
            entries
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().ends_with(".m4s"))
                .count()
        });

        if ahead > 20 {
            break;
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/segment00025.m4s"))).await;

    assert_eq!(
        status,
        StatusCode::OK,
        "a paused run must be woken, not waited on"
    );
    assert!(bytes.len() > 512, "segment was {} bytes", bytes.len());
}

/// A run that has ended must not be waited for.
///
/// A session recorded which run was live and nothing cleared it when the run
/// exited, so every request for a segment that run never wrote waited the full
/// timeout and was then refused. A viewer saw the stream stop for good after
/// scrubbing — measured across twenty one runs, where segment 237 waited
/// thirty seconds for a transcode that had already finished.
#[tokio::test]
async fn produces_a_segment_again_after_the_run_that_wrote_it_has_ended() {
    let _ = std::fs::remove_dir_all(cache_root("ended"));

    let app = app(registry("ended"));
    let (_, body) = start(&app, &spec(VideoAction::Copy, AudioAction::Copy)).await;
    let id = body["id"].as_str().expect("has an id").to_owned();
    let directory = cache_root("ended").join(&id);

    for _ in 0..100 {
        if directory.join(".complete").exists() {
            break;
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let segment = directory.join("segment00001.m4s");

    assert!(segment.exists(), "the run wrote the segment first");

    std::fs::remove_file(&segment).expect("takes the segment away");

    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/segment00001.m4s"))).await;

    assert_eq!(
        status,
        StatusCode::OK,
        "the run should have been started again"
    );
    assert!(bytes.len() > 512, "segment was {} bytes", bytes.len());
}

/// One viewer closing a tab must not take the film away from the other.
///
/// Everybody watching the same thing shares one session, so a stop that
/// cancelled the transcode outright ended the other viewer's stream — their
/// manifest went missing mid-film. The session lives until the last of them
/// lets go. See ADR-0011.
#[tokio::test]
async fn keeps_a_session_while_another_viewer_is_watching() {
    let registry = registry("shared");
    let app = app(registry.clone());
    let subject = spec(VideoAction::Copy, AudioAction::Copy);

    let (_, first) = start(&app, &subject).await;
    let (_, second) = start(&app, &subject).await;
    let id = first["id"].as_str().expect("has an id").to_owned();

    assert_eq!(second["id"].as_str(), Some(id.as_str()));

    let leave = Request::builder()
        .method("DELETE")
        .uri(format!("/sessions/{id}"))
        .body(Body::empty())
        .expect("builds the request");

    let (status, _) = call(&app, leave).await;

    assert_eq!(status, StatusCode::NO_CONTENT);
    assert_eq!(registry.len().await, 1, "one viewer is still watching");

    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/index.m3u8"))).await;

    assert_eq!(status, StatusCode::OK);
    assert!(String::from_utf8_lossy(&bytes).starts_with("#EXTM3U"));
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

    registry.stop(&id, None).await;

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

/// The playlist describes the film, not the part of it that has been made.
///
/// A player given a playlist that grows as segments appear can only seek
/// within what has already been transcoded, which is why seeking used to start
/// a second transcode of the remainder. This one names every segment of a two
/// minute source while almost none of them exist, and declares how long the
/// film runs before any of it has been produced.
#[tokio::test]
async fn describes_the_whole_film_before_transcoding_it() {
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
    assert!(manifest.contains("#EXT-X-PLAYLIST-TYPE:VOD"), "{manifest}");

    let named = manifest.matches(".m4s\n").count();
    let written = std::fs::read_dir(cache_root("growing").join(id))
        .expect("reads the session directory")
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(".m4s"))
        .count();

    assert_eq!(named, 30, "a two minute film in four second segments");
    assert!(
        written < named,
        "the transcode finished during the test, which proves nothing: {written} of {named}"
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

/// A seek is answered where it landed, not after everything before it.
///
/// The run walking through the opening of the film is stopped and another
/// started at the segment that was asked for. Nothing produces the eighty
/// seconds in between, and the file that arrives carries its own place in the
/// film in its name — which is what lets a later run pick up where this one is
/// stopped.
#[tokio::test]
async fn starts_a_run_where_a_viewer_seeked_to() {
    let _ = std::fs::remove_dir_all(cache_root("far-seek"));

    let app = app(registry("far-seek"));
    let subject = SessionSpec {
        input_path: long_source_file().to_string_lossy().into_owned(),
        segment_seconds: 4,
        video: VideoAction::Encode {
            encoder: "libx264".into(),
            max_bitrate_kbps: 6000,
            max_width: 640,
            max_height: 360,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        ..spec(VideoAction::Copy, AudioAction::Copy)
    };

    let (status, body) = start(&app, &subject).await;

    assert_eq!(status, StatusCode::OK, "{body}");

    let id = body["id"].as_str().expect("names the session").to_owned();
    let (status, bytes) = call(&app, get(&format!("/sessions/{id}/segment00025.m4s"))).await;

    assert_eq!(status, StatusCode::OK, "a seek to 100 seconds in");
    assert!(bytes.len() > 512, "segment was {} bytes", bytes.len());

    let written: Vec<String> = std::fs::read_dir(cache_root("far-seek").join(&id))
        .expect("reads the session directory")
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.ends_with(".m4s"))
        .collect();

    assert!(
        !written.contains(&"segment00012.m4s".to_owned()),
        "nothing should have transcoded the film in between: {written:?}"
    );
}
