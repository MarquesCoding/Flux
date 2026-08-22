//! Checks that Valence reads the HDR systems it claims to know.
//!
//! These two fixtures are the reason this file exists. Dolby Vision announces itself in a
//! configuration record on the stream; HDR10+ rides in an SEI on every frame. A probe that reads
//! only streams finds the first and never the second, which is exactly what Valence did — every
//! HDR10+ file came back as plain HDR10 and `VideoRange::Hdr10Plus` could not be returned at all.
//! The test that covered it passed throughout, because it put the metadata somewhere ffprobe never
//! puts it.
//!
//! Neither can be authored by `FFmpeg`, so the fixtures are synthesised: an HDR10 base stream, the
//! metadata written from a description rather than taken from any real file, and mkvmerge to mux
//! it — `FFmpeg`'s own muxers lose a Dolby Vision RPU. See VAL-132.
//!
//! Skips loudly when they are absent. Build them with `pnpm fixtures:sync --tier 2`.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;

mod common;

use common::ffprobe;
use valence_transcoder::media::{VideoRange, VideoStream};
use valence_transcoder::probe::probe_media;

/// Where the corpus lives, matching `fixturesDirectory` on the TypeScript side.
fn corpus_directory() -> PathBuf {
    if let Ok(configured) = std::env::var("VALENCE_FIXTURES_DIR") {
        if !configured.trim().is_empty() {
            return PathBuf::from(configured);
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();

    PathBuf::from(home).join(".cache").join("valence-fixtures")
}

async fn video_of(name: &str) -> Option<VideoStream> {
    let path = corpus_directory().join(name);

    if !path.exists() {
        eprintln!("skipping: no {name}. Build it with `pnpm fixtures:sync --tier 2`.");

        return None;
    }

    let probe = probe_media(&ffprobe(), &path)
        .await
        .expect("probes the fixture");

    Some(probe.video.expect("has video"))
}

/// A Dolby Vision stream is not reported as the HDR10 it is layered over.
///
/// Profile 8.1 is the awkward one on purpose: its base layer *is* HDR10, and it carries a
/// configuration record on the stream and an RPU on every frame at once. Reporting HDR10 for it
/// would silently discard the dynamic metadata in a transcode.
#[tokio::test]
async fn reads_dolby_vision_rather_than_the_hdr10_beneath_it() {
    let Some(video) = video_of("dolby-vision-profile-81.mkv").await else {
        return;
    };

    assert_eq!(video.range, VideoRange::DolbyVision);
}

/// And the HDR10 underneath it is read as well, which is what lets it be sent untouched.
///
/// Reading the range alone is what made Valence re-encode this file for every screen in the house. The
/// stream says `dv_bl_signal_compatibility_id` is one, meaning the base layer is ordinary HDR10, so
/// an HDR10 client is sent the file as it is and shows the picture the format left for it.
#[tokio::test]
async fn reads_the_hdr10_base_that_makes_profile_81_playable_elsewhere() {
    let Some(video) = video_of("dolby-vision-profile-81.mkv").await else {
        return;
    };

    assert_eq!(video.range_base, VideoRange::Hdr10);
}

/// HDR10+ is reported as itself, from metadata that only appears once a frame is read.
///
/// This is the case that was unreachable. Without a fixture carrying real SMPTE 2094-40 there was
/// nothing to notice that the probe never looked at a frame.
#[tokio::test]
async fn reads_hdr10_plus_from_a_file_that_actually_has_it() {
    let Some(video) = video_of("hdr10plus-dynamic.mkv").await else {
        return;
    };

    assert_eq!(video.range, VideoRange::Hdr10Plus);
    assert_eq!(video.range_base, VideoRange::Hdr10);
}

/// The HDR10 fixture stays HDR10, so the two above are not passing by accident.
#[tokio::test]
async fn does_not_promote_plain_hdr10_to_something_dynamic() {
    let Some(video) = video_of("hevc-10bit-hdr10.mp4").await else {
        return;
    };

    assert_eq!(video.range, VideoRange::Hdr10);
    assert_eq!(video.range_base, VideoRange::Hdr10);
}
