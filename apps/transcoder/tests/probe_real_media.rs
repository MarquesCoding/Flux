//! Probing against real media produced by `FFmpeg`.
//!
//! These are the Tier 0 fixtures from ADR-0012: generated on the fly rather
//! than downloaded, so they cost no bandwidth and raise no licensing question.
//! They exist because parsing captured JSON cannot catch the things that
//! actually break — a colour transfer that never reached the bitstream, a bit
//! depth reported only in the pixel format.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;

use flux_transcoder::media::{Container, VideoRange};
use flux_transcoder::probe::probe_media;

mod common;

use common::{building_name, ffmpeg, ffprobe, fixture_dir, require_ffmpeg};

fn generate(name: &str, args: &[&str]) -> PathBuf {
    require_ffmpeg();

    let path = fixture_dir().join(name);
    let building = fixture_dir().join(building_name(name));

    if path.exists() {
        return path;
    }

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args(args)
        .arg("-y")
        .arg(&building)
        .status()
        .expect("runs ffmpeg");

    assert!(
        status.success(),
        "ffmpeg could not generate the {name} fixture"
    );

    std::fs::rename(&building, &path).expect("moves the finished fixture into place");

    path
}

fn sdr_mp4() -> PathBuf {
    generate(
        "sdr.mp4",
        &[
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
            "1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-ac",
            "2",
        ],
    )
}

fn hdr10_mp4() -> PathBuf {
    generate(
        "hdr10.mp4",
        &[
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
            "1",
            "-c:v",
            "libx265",
            "-pix_fmt",
            "yuv420p10le",
            "-x265-params",
            "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc",
            "-c:a",
            "eac3",
            "-ac",
            "6",
            "-tag:v",
            "hvc1",
        ],
    )
}

fn hlg_mp4() -> PathBuf {
    generate(
        "hlg.mp4",
        &[
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x240:rate=25",
            "-t",
            "1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-x264-params",
            "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc",
        ],
    )
}

fn subtitles_mkv() -> PathBuf {
    let subtitle = fixture_dir().join("sample.srt");

    std::fs::write(&subtitle, "1\n00:00:00,000 --> 00:00:01,000\nhello\n\n")
        .expect("writes the subtitle fixture");

    let subtitle_path = subtitle.to_string_lossy().into_owned();

    generate(
        "subtitles.mkv",
        &[
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x240:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-i",
            &subtitle_path,
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-map",
            "2:s",
            "-t",
            "1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "flac",
            "-c:s",
            "srt",
            "-metadata:s:a:0",
            "language=eng",
            "-metadata:s:s:0",
            "language=eng",
        ],
    )
}

async fn probe(path: &Path) -> flux_transcoder::media::MediaProbe {
    probe_media(&ffprobe(), path)
        .await
        .expect("probes the fixture")
}

#[tokio::test]
async fn reads_an_sdr_file() {
    let result = probe(&sdr_mp4()).await;
    let video = result.video.expect("has video");

    assert_eq!(video.codec, "h264");
    assert_eq!(video.range, VideoRange::Sdr);
    assert_eq!(video.width, 320);
    assert_eq!(video.bit_depth, Some(8));
    assert_eq!(result.audio_streams[0].codec, "aac");
    assert_eq!(result.audio_streams[0].channels, 2);
}

#[tokio::test]
async fn detects_hdr10_from_a_real_file() {
    let result = probe(&hdr10_mp4()).await;
    let video = result.video.expect("has video");

    assert_eq!(video.codec, "hevc");
    assert_eq!(video.range, VideoRange::Hdr10);
}

#[tokio::test]
async fn reads_ten_bit_depth_from_the_pixel_format() {
    let result = probe(&hdr10_mp4()).await;

    assert_eq!(result.video.expect("has video").bit_depth, Some(10));
}

#[tokio::test]
async fn detects_hlg_from_a_real_file() {
    let result = probe(&hlg_mp4()).await;

    assert_eq!(result.video.expect("has video").range, VideoRange::Hlg);
}

#[tokio::test]
async fn reads_a_matroska_file_with_subtitles() {
    let result = probe(&subtitles_mkv()).await;

    assert_eq!(result.container, Container::Mkv);
    assert_eq!(result.audio_streams[0].codec, "flac");
    assert_eq!(result.audio_streams[0].language.as_deref(), Some("eng"));
    assert_eq!(result.subtitle_streams[0].format, "srt");
    assert!(!result.subtitle_streams[0].is_image_based);
}

#[tokio::test]
async fn reports_a_duration() {
    let result = probe(&sdr_mp4()).await;

    assert!(result.duration_seconds > 0.5, "expected a real duration");
}

#[tokio::test]
async fn fails_on_a_file_that_is_not_media() {
    let path = fixture_dir().join("not-media.txt");
    std::fs::write(&path, "this is not a video").expect("writes the file");

    assert!(probe_media(&ffprobe(), &path).await.is_err());
}
