//! Checks the range of whatever real media is on this machine.
//!
//! Generated fixtures cannot carry Dolby Vision or HDR10+: an RPU is something
//! ffmpeg passes through but cannot create, and HDR10+ needs an x265 built with
//! `--dhdr10-info`. So the only way to test them is against a real file, and
//! the only real files are the ones an operator already has.
//!
//! Nothing here is committed and nothing is fetched. The library is read where
//! it sits, and the test skips loudly when there is nothing in it. See
//! FLUX-132.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;

use flux_transcoder::media::VideoRange;
use flux_transcoder::probe::probe_media;

fn library() -> Vec<PathBuf> {
    let root = std::env::var("FLUX_LOCAL_MEDIA").map_or_else(
        |_| PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Flux"),
        PathBuf::from,
    );

    let mut found = Vec::new();
    let mut stack = vec![root];

    while let Some(directory) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_dir() {
                stack.push(path);
            } else if matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("mkv" | "mp4" | "m4v" | "ts" | "webm")
            ) {
                found.push(path);
            }
        }
    }

    found.sort();
    found
}

/// Every file in the library reports a range, and an HDR one never reads as SDR.
///
/// The failure this exists for: HDR10+ metadata rides on the frames, so a probe
/// that reads only streams reports plain HDR10 for every HDR10+ file there is.
/// A synthetic fixture cannot catch that, because no synthetic fixture has
/// HDR10+ in it.
#[tokio::test]
async fn reads_the_range_of_every_real_file() {
    let files = library();

    if files.is_empty() {
        eprintln!(
            "skipping: no media found. Point FLUX_LOCAL_MEDIA at a library, or put files in ~/Flux."
        );

        return;
    }

    for path in files {
        let Ok(probe) = probe_media("ffprobe", &path).await else {
            continue;
        };

        let Some(video) = probe.video else {
            continue;
        };

        let name = path.file_name().unwrap_or_default().to_string_lossy();
        let claims_hdr =
            name.to_lowercase().contains("hdr") || name.to_lowercase().contains("dolby");

        eprintln!("{name}: {:?}", video.range);

        if claims_hdr {
            assert_ne!(
                video.range,
                VideoRange::Sdr,
                "{name} announces HDR in its name and probed as SDR"
            );
        }
    }
}
