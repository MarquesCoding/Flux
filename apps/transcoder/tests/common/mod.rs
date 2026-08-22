//! What every media test needs to find `FFmpeg` and build a fixture with it.
//!
//! Cargo compiles each file directly under `tests/` as its own binary, so anything they share has
//! to sit in a subdirectory or it becomes a test binary of its own. Before this existed the same
//! helpers were copied into ten files, three of them had drifted into asking for `ffmpeg` by name
//! rather than reading the variable, and the race in `generate` had to be fixed five times over.

#![allow(
    dead_code,
    reason = "each test binary is compiled separately and uses a different part of this"
)]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

/// Gives each half-written fixture a name nothing else will pick up.
static BUILDING: AtomicU64 = AtomicU64::new(0);

/// The `FFmpeg` to drive, which is the one Valence ships wherever it has been pointed at.
///
/// Never the bare name where a variable was set: a container carrying Valence's own build has no
/// system `FFmpeg` at all, so a test that asks for `ffmpeg` finds nothing.
#[must_use]
pub fn ffmpeg() -> String {
    std::env::var("VALENCE_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

/// The ffprobe beside it.
#[must_use]
pub fn ffprobe() -> String {
    std::env::var("VALENCE_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

/// Where generated fixtures are kept, outside the working tree.
#[must_use]
pub fn fixture_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("valence-fixtures");

    std::fs::create_dir_all(&dir).expect("creates the fixture directory");

    dir
}

/// A name to write a fixture under before it is moved into place.
///
/// The tests in a file run in parallel and `exists` becomes true the moment `FFmpeg` creates a file
/// rather than when it has finished writing it, so one test read a fixture another was still
/// producing. A rename is atomic, so the real name only ever appears on a finished file.
#[must_use]
pub fn building_name(name: &str) -> String {
    format!(
        ".building-{}-{}-{name}",
        std::process::id(),
        BUILDING.fetch_add(1, Ordering::Relaxed)
    )
}

/// Builds a fixture once, whole, and hands back where it is.
///
/// Returns immediately when the fixture is already there, which is what makes a second run of the
/// suite fast. `args` are everything between the log flags and the output path.
#[must_use]
pub fn generate(name: &str, args: &[&str]) -> PathBuf {
    let path = fixture_dir().join(name);

    if path.exists() {
        return path;
    }

    let building = fixture_dir().join(building_name(name));

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error", "-y"])
        .args(args)
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

/// Whether `FFmpeg` can be run at all, for a test that should skip rather than fail without it.
#[must_use]
pub fn is_available() -> bool {
    Command::new(ffprobe())
        .arg("-version")
        .output()
        .is_ok_and(|output| output.status.success())
}

/// Stops a test that cannot run without `FFmpeg`, saying what to do about it.
pub fn require_ffmpeg() {
    assert!(
        is_available(),
        "ffmpeg is required to run the media tests. Install it, or set VALENCE_FFMPEG to its path."
    );
}

/// The earliest presentation time in a media file.
#[must_use]
pub fn first_pts(path: &Path) -> Option<f64> {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "packet=pts_time",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .ok()?;

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().trim_end_matches(',').parse::<f64>().ok())
        .fold(None, |earliest: Option<f64>, time| {
            Some(earliest.map_or(time, |value| value.min(time)))
        })
}
