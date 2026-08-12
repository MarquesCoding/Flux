//! Whether the decode check actually catches a broken file.
//!
//! The unit tests prove the arguments are the ones Flux meant to pass. They
//! cannot prove the check works, and that distinction is the whole reason this
//! file exists: the fault it guards against reached a library because previews
//! were verified on frame counts and file sizes, both of which a corrupt clip
//! reports perfectly well. Only decoding one settles it.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

use flux_transcoder::integrity::decodes;

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn has_ffmpeg() -> bool {
    Command::new(ffmpeg())
        .arg("-version")
        .output()
        .is_ok_and(|outcome| outcome.status.success())
}

fn directory() -> PathBuf {
    let path = std::env::temp_dir().join("flux-integrity");

    std::fs::create_dir_all(&path).expect("creates the fixture directory");

    path
}

/// A short clip that is genuinely playable.
fn sound_clip(name: &str) -> PathBuf {
    let path = directory().join(name);

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .args([
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x240:rate=25",
            "-t",
            "2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
        ])
        .arg("-y")
        .arg(&path)
        .status()
        .expect("runs ffmpeg");

    assert!(status.success(), "the fixture itself must encode");

    path
}

#[tokio::test]
async fn accepts_a_clip_that_plays() {
    if !has_ffmpeg() {
        return;
    }

    let path = sound_clip("sound.mp4");

    assert!(
        decodes(&ffmpeg(), &path).await.is_ok(),
        "a clip ffmpeg just wrote must pass its own check"
    );
}

/// Scribbles over the middle of a file, leaving its header intact.
///
/// Halfway through lands inside the encoded frames rather than the container,
/// so the file still describes a whole clip of the right length and dimensions
/// and still reports a plausible size. That is the shape of the fault this
/// guards against: everything the old check looked at stays correct, and only
/// decoding reveals it.
fn damage_the_bitstream(path: &Path) {
    let size = std::fs::metadata(path).expect("reads the fixture").len();

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(path)
        .expect("opens the fixture");

    file.seek(SeekFrom::Start(size / 2)).expect("seeks");
    file.write_all(&[0xFF; 4096]).expect("scribbles");
    file.flush().expect("flushes");
}

#[tokio::test]
async fn rejects_a_clip_whose_bitstream_is_damaged() {
    if !has_ffmpeg() {
        return;
    }

    let path = sound_clip("damaged.mp4");

    damage_the_bitstream(&path);

    assert!(
        decodes(&ffmpeg(), &path).await.is_err(),
        "a damaged bitstream must not be marked complete"
    );
}

#[tokio::test]
async fn rejects_a_file_that_is_not_video_at_all() {
    if !has_ffmpeg() {
        return;
    }

    let path = directory().join("not-video.mp4");

    std::fs::write(&path, b"this is not a video file").expect("writes the fixture");

    assert!(decodes(&ffmpeg(), &path).await.is_err());
}

#[tokio::test]
async fn says_why_rather_than_only_that_it_failed() {
    if !has_ffmpeg() {
        return;
    }

    let path = directory().join("empty.mp4");

    std::fs::write(&path, b"").expect("writes the fixture");

    let reason = decodes(&ffmpeg(), &path)
        .await
        .expect_err("an empty file cannot decode");

    assert!(
        !reason.is_empty(),
        "a failure nobody can read is a failure nobody can fix"
    );
}
