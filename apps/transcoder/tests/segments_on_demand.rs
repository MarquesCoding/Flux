//! Producing a segment from the middle of a film, without transcoding the rest.
//!
//! This is the property the whole change exists for: asking for a segment part
//! way in should cost one short run, and what comes back should sit in the
//! film's timeline rather than at the beginning of it.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;

use flux_transcoder::fragment::fragment_positions;
use flux_transcoder::playlist::build_vod_playlist;
use flux_transcoder::segments::{window_start, SegmentRegistry, SegmentRequest, INIT_NAME, WINDOW};

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn ffprobe() -> String {
    std::env::var("FLUX_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

fn available() -> bool {
    Command::new(ffmpeg())
        .arg("-version")
        .output()
        .is_ok_and(|output| output.status.success())
}

/// Two minutes of film with a keyframe every four seconds.
fn source(at: &Path) {
    let status = Command::new(ffmpeg())
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "120",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-g",
            "100",
            "-keyint_min",
            "100",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
        ])
        .arg(at)
        .status()
        .expect("ran ffmpeg");

    assert!(status.success(), "could not build the source");
}

#[tokio::test]
async fn produces_a_segment_from_the_middle_without_transcoding_the_start() {
    if !available() {
        eprintln!("skipping: no ffmpeg on this machine");

        return;
    }

    let root: PathBuf = std::env::temp_dir().join(format!("flux-ondemand-{}", std::process::id()));
    std::fs::create_dir_all(&root).expect("made a directory");

    let film = root.join("source.mp4");
    source(&film);

    let directory = root.join("plan");
    let lengths: Vec<f64> = std::iter::repeat_n(4.0, 30).collect();

    let encode: Vec<String> = ["-c:v", "copy", "-c:a", "aac", "-ac", "2"]
        .iter()
        .map(|argument| (*argument).to_owned())
        .collect();

    let request = SegmentRequest {
        ffmpeg: &ffmpeg(),
        input_path: &film.to_string_lossy(),
        directory: &directory,
        lengths: &lengths,
        encode: &encode,
    };

    let registry = SegmentRegistry::new();

    let wanted = 20;
    let produced = registry
        .ensure(&request, wanted)
        .await
        .expect("produced the segment that was asked for");

    assert!(produced.exists(), "the segment named does not exist");

    let written = std::fs::read_dir(&directory)
        .expect("read the directory")
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("segment"))
        .count();

    assert!(
        written <= WINDOW as usize,
        "a request for one segment produced {written}, which is more than a window"
    );

    assert!(
        !directory.join("segment00000.m4s").exists(),
        "the start of the film was transcoded for a request in the middle"
    );

    let positions = fragment_positions(&std::fs::read(&produced).expect("read the segment"));

    assert!(
        positions.values().any(|position| *position > 0),
        "the segment claims to start at the beginning of the film: {positions:?}"
    );

    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test]
async fn asking_twice_produces_once() {
    if !available() {
        eprintln!("skipping: no ffmpeg on this machine");

        return;
    }

    let root: PathBuf = std::env::temp_dir().join(format!("flux-once-{}", std::process::id()));
    std::fs::create_dir_all(&root).expect("made a directory");

    let film = root.join("source.mp4");
    source(&film);

    let directory = root.join("plan");
    let lengths: Vec<f64> = std::iter::repeat_n(4.0, 30).collect();
    let encode: Vec<String> = ["-c:v", "copy", "-c:a", "aac", "-ac", "2"]
        .iter()
        .map(|argument| (*argument).to_owned())
        .collect();

    let request = SegmentRequest {
        ffmpeg: &ffmpeg(),
        input_path: &film.to_string_lossy(),
        directory: &directory,
        lengths: &lengths,
        encode: &encode,
    };

    let registry = SegmentRegistry::new();

    registry.ensure(&request, 8).await.expect("first");
    let written = std::fs::metadata(directory.join("segment00008.m4s"))
        .expect("a segment")
        .modified()
        .expect("a time");

    registry.ensure(&request, 8).await.expect("second");
    let again = std::fs::metadata(directory.join("segment00008.m4s"))
        .expect("a segment")
        .modified()
        .expect("a time");

    let _ = std::fs::remove_dir_all(&root);

    assert_eq!(written, again, "the segment was produced a second time");
}

/// Segments produced separately have to decode as one film.
#[tokio::test]
async fn segments_from_different_runs_decode_as_one_film() {
    if !available() {
        eprintln!("skipping: no ffmpeg on this machine");

        return;
    }

    let root: PathBuf = std::env::temp_dir().join(format!("flux-whole-{}", std::process::id()));
    std::fs::create_dir_all(&root).expect("made a directory");

    let film = root.join("source.mp4");
    source(&film);

    let directory = root.join("plan");
    let lengths: Vec<f64> = std::iter::repeat_n(4.0, 12).collect();
    let encode: Vec<String> = ["-c:v", "copy", "-c:a", "aac", "-ac", "2"]
        .iter()
        .map(|argument| (*argument).to_owned())
        .collect();

    let request = SegmentRequest {
        ffmpeg: &ffmpeg(),
        input_path: &film.to_string_lossy(),
        directory: &directory,
        lengths: &lengths,
        encode: &encode,
    };

    let registry = SegmentRegistry::new();

    for index in [6, 0] {
        registry.ensure(&request, index).await.expect("a segment");
    }

    assert_ne!(
        window_start(6),
        window_start(0),
        "these indices must fall in different runs or the test proves nothing"
    );

    let playlist = directory.join("index.m3u8");
    std::fs::write(&playlist, build_vod_playlist(&lengths, INIT_NAME)).expect("wrote a playlist");

    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-count_frames",
            "-select_streams",
            "v",
            "-show_entries",
            "stream=nb_read_frames",
            "-of",
            "csv=p=0",
        ])
        .arg(&playlist)
        .output()
        .expect("ran ffprobe");

    let decoded: u64 = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .and_then(|line| line.trim().parse().ok())
        .unwrap_or(0);

    let _ = std::fs::remove_dir_all(&root);

    let expected = 48 * 25;

    assert!(
        decoded.abs_diff(expected) < 25,
        "decoded {decoded} frames of an expected {expected}, so the segments do not line up"
    );
}
