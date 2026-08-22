//! Checks that a generated playlist is one a parser will actually take.
//!
//! The unit tests cover its shape. This covers the thing they cannot: whether
//! ffprobe reads the playlist as a film, with a duration and streams, rather
//! than merely as text of the right form.
//!
//! The fixture is generated here rather than downloaded, following ADR-0012.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::Path;
use std::process::Command;

use valence_transcoder::playlist::build_vod_playlist;
use valence_transcoder::transcode_plan::SegmentContainer;

mod common;

use common::{ffmpeg, ffprobe};

/// Cuts a short film into real fMP4 segments and returns their lengths.
fn segment_a_film(directory: &Path) -> Vec<f64> {
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
            "20",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-g",
            "50",
            "-keyint_min",
            "50",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-f",
            "hls",
            "-hls_time",
            "2",
            "-hls_playlist_type",
            "vod",
            "-hls_list_size",
            "0",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            "init.mp4",
            "-hls_segment_filename",
        ])
        .arg(directory.join("segment%05d.m4s"))
        .arg(directory.join("ffmpeg.m3u8"))
        .status()
        .expect("ran ffmpeg");

    assert!(status.success(), "could not build the fixture");

    std::fs::read_to_string(directory.join("ffmpeg.m3u8"))
        .expect("a playlist")
        .lines()
        .filter_map(|line| line.strip_prefix("#EXTINF:"))
        .filter_map(|value| value.trim_end_matches(',').parse().ok())
        .collect()
}

#[test]
fn ffprobe_reads_a_generated_playlist_as_a_film() {
    if !common::is_available() {
        eprintln!("skipping: no ffprobe on this machine");

        return;
    }

    let directory = std::env::temp_dir().join(format!("valence-playlist-{}", std::process::id()));
    std::fs::create_dir_all(&directory).expect("made a directory");

    let lengths = segment_a_film(&directory);

    assert!(!lengths.is_empty(), "ffmpeg wrote no segments");

    let path = directory.join("valence.m3u8");
    std::fs::write(&path, build_vod_playlist(&lengths, SegmentContainer::Fmp4))
        .expect("wrote the playlist");

    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-allowed_extensions",
            "ALL",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
        ])
        .arg(&path)
        .output()
        .expect("ran ffprobe");

    let reported: f64 = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap_or(0.0);
    let expected: f64 = lengths.iter().sum();

    let _ = std::fs::remove_dir_all(&directory);

    assert!(
        output.status.success(),
        "ffprobe refused the playlist: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    assert!(
        (reported - expected).abs() < 1.0,
        "ffprobe read {reported}s where the segments total {expected}s"
    );
}
