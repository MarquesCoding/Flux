//! Puts the boundary rules against every fixture in the corpus.
//!
//! All of them were derived from one film. `segment_lengths` claims to predict
//! the start of every segment ffmpeg writes; `cut_interval` claims to make a
//! copied stream cut in the same places wherever a run began; `Cut::is_safe`
//! claims to identify the cuts a decoder cannot start at. Each was measured
//! against a Bluray remux of open-GOP HEVC Main 10 and generalised to
//! everything.
//!
//! This asks the same questions of five codecs, both GOP structures, keyframes
//! near and far apart, interlaced and variable frame timing. The prediction is
//! compared against what ffmpeg actually wrote rather than against a stored
//! answer, so a rule that only ever held for one file has nowhere to hide.
//!
//! Skips loudly when the corpus is absent, as ADR-0012 requires. Build it with
//! `pnpm fixtures:sync`.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;

use valence_transcoder::boundaries::can_copy_segments;
use valence_transcoder::keyframes::{
    cut_interval, longest_segment, parse_cuts, seek_into, segment_lengths, segment_starts,
    Keyframes,
};

mod common;

use common::{ffmpeg, ffprobe, first_pts};

/// What Valence asks for, and what the rules are tuned around.
const REQUESTED_SEGMENT_SECONDS: f64 = 4.0;

/// How far a predicted boundary may sit from the one ffmpeg wrote.
///
/// A frame at twenty-five frames a second is 0.04s. Half of one is tight enough
/// that a real disagreement shows and loose enough that rounding in the
/// container's timebase does not.
const TOLERANCE_SECONDS: f64 = 0.02;

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

/// Whether a file has a video stream at all.
///
/// The corpus carries audio-only fixtures, for the codec profiles that only
/// audio has. A file with no picture has no segments, so it has nothing to say
/// about where they fall.
fn has_video(path: &Path) -> bool {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output();

    output.is_ok_and(|output| !String::from_utf8_lossy(&output.stdout).trim().is_empty())
}

/// Every fixture on disk, in a stable order.
fn corpus() -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(corpus_directory()) else {
        return Vec::new();
    };

    let mut found: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("mp4" | "mkv" | "ts" | "webm")
            )
        })
        .filter(|path| has_video(path))
        .collect();

    found.sort();
    found
}

fn duration_of(path: &Path) -> f64 {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .expect("ran ffprobe");

    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap_or(0.0)
}

/// Reads the keyframes the same way the service does, without its async runtime.
fn keyframes_of(path: &Path) -> Keyframes {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "packet=pts_time,flags",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .expect("ran ffprobe");

    parse_cuts(&String::from_utf8_lossy(&output.stdout), duration_of(path))
}

/// Where each segment ffmpeg wrote really begins, relative to the first.
///
/// Measured from the media rather than read from `#EXTINF`, because they do not
/// agree and only one of them matters. On an open GOP ffmpeg rounds its
/// declared durations to the cut it was asked for while the packets land
/// wherever the leading pictures put them — the playlist says 2.000 where the
/// media starts at 1.960. A player maps playlist time onto media time, so the
/// media is the thing a boundary has to predict.
fn actual_starts(path: &Path, cut_seconds: f64, directory: &Path) -> Vec<f64> {
    let _ = std::fs::remove_dir_all(directory);
    std::fs::create_dir_all(directory).expect("made a directory");

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(path)
        .args([
            "-c",
            "copy",
            "-map",
            "0:v:0",
            "-f",
            "hls",
            "-hls_time",
            &format!("{cut_seconds:.6}"),
            "-hls_playlist_type",
            "vod",
            "-hls_list_size",
            "0",
            "-hls_segment_filename",
        ])
        .arg(directory.join("segment%05d.ts"))
        .arg(directory.join("out.m3u8"))
        .status()
        .expect("ran ffmpeg");

    if !status.success() {
        return Vec::new();
    }

    let names: Vec<String> = std::fs::read_to_string(directory.join("out.m3u8"))
        .unwrap_or_default()
        .lines()
        .filter(|line| {
            std::path::Path::new(line)
                .extension()
                .is_some_and(|value| value == "ts")
        })
        .map(str::to_owned)
        .collect();

    let firsts: Vec<f64> = names
        .iter()
        .filter_map(|name| first_pts(&directory.join(name)))
        .collect();

    let Some(origin) = firsts.first().copied() else {
        return Vec::new();
    };

    firsts.iter().map(|pts| pts - origin).collect()
}

fn name_of(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_owned()
}

/// Every fixture is read, and its keyframes make sense.
///
/// The floor under everything else: a source whose keyframes cannot be read at
/// all would make every rule below vacuously true.
#[test]
fn reads_keyframes_from_every_fixture() {
    let fixtures = corpus();

    if fixtures.is_empty() {
        eprintln!("skipping: no corpus. Build it with `pnpm fixtures:sync`.");

        return;
    }

    for path in fixtures {
        let keyframes = keyframes_of(&path);

        assert!(
            !keyframes.cuts.is_empty(),
            "{}: no keyframes found",
            name_of(&path)
        );
        assert!(
            keyframes.duration_seconds > 0.0,
            "{}: no duration",
            name_of(&path)
        );

        let ascending = keyframes
            .cuts
            .windows(2)
            .all(|pair| pair[0].at_seconds <= pair[1].at_seconds);

        assert!(ascending, "{}: keyframes are out of order", name_of(&path));
    }
}

/// Open GOPs are recognised as such, and closed ones are not maligned.
///
/// `Cut::is_safe` decides whether a segment can be started at, and until now it
/// had only ever seen one open-GOP file. A closed-GOP source reporting unsafe
/// cuts would refuse copies that should be allowed; an open-GOP source
/// reporting none would deliver segments that stall.
///
/// The two codecs open their GOPs by different means — HEVC with a CRA and
/// HEVC-specific leading pictures, H.264 with a recovery point and no IDR at
/// all — and the rule reads neither. It compares presentation times, which is
/// why it catches both: 7 of 15 keyframes on the H.264 fixture and 13 of 15 on
/// the HEVC one.
#[test]
fn tells_an_open_gop_from_a_closed_one() {
    let fixtures = corpus();

    if fixtures.is_empty() {
        eprintln!("skipping: no corpus. Build it with `pnpm fixtures:sync`.");

        return;
    }

    for path in fixtures {
        let name = name_of(&path);
        let keyframes = keyframes_of(&path);
        let unsafe_cuts = keyframes.cuts.iter().filter(|cut| !cut.is_safe()).count();

        if name.contains("-closed") || name.starts_with("container-") || name.starts_with("audio-")
        {
            assert_eq!(
                unsafe_cuts, 0,
                "{name}: a closed GOP should have no cut a decoder cannot start at"
            );
        }

        if name.contains("-open") {
            assert!(
                unsafe_cuts > 0,
                "{name}: an open GOP should report cuts a decoder cannot start at"
            );
        }
    }
}

/// The lengths Valence declares are the lengths ffmpeg writes.
///
/// This is the claim the whole playlist rests on, and the one measured against
/// a single film. A playlist that declares boundaries the muxer does not
/// produce is a seek bar that lands somewhere other than where it was dropped.
#[test]
fn predicts_the_segments_ffmpeg_actually_writes() {
    let fixtures = corpus();

    if fixtures.is_empty() {
        eprintln!("skipping: no corpus. Build it with `pnpm fixtures:sync`.");

        return;
    }

    let scratch = std::env::temp_dir().join(format!("valence-corpus-{}", std::process::id()));
    let mut disagreements: Vec<String> = Vec::new();

    for path in fixtures {
        let name = name_of(&path);

        if path.extension().is_some_and(|value| value == "webm") {
            continue;
        }

        let keyframes = keyframes_of(&path);
        let cut = cut_interval(&keyframes, REQUESTED_SEGMENT_SECONDS);
        let predicted = segment_lengths(&keyframes, cut);
        let actual = actual_starts(&path, cut, &scratch);

        if actual.is_empty() {
            continue;
        }

        if predicted.len() != actual.len() {
            disagreements.push(format!(
                "{name}: predicted {} segments, ffmpeg wrote {}",
                predicted.len(),
                actual.len()
            ));

            continue;
        }

        let mut predicted_start: f64 = 0.0;

        for (index, (length, written)) in predicted.iter().zip(actual.iter()).enumerate() {
            if (predicted_start - written).abs() > TOLERANCE_SECONDS {
                disagreements.push(format!(
                    "{name}: segment {index} starts at {predicted_start:.3} predicted, {written:.3} written"
                ));

                break;
            }

            predicted_start += length;
        }
    }

    let _ = std::fs::remove_dir_all(&scratch);

    assert!(
        disagreements.is_empty(),
        "the boundaries do not describe what ffmpeg produced:\n{}",
        disagreements.join("\n")
    );
}

/// Copying is refused exactly when the segments it would produce are unusable.
///
/// The segments that count are the ones the muxer writes, which is one per
/// keyframe whether or not that keyframe carries leading pictures. This test
/// used to measure the other thing — the lengths left after passing those
/// keyframes over — and a fixture with open GOPs far apart failed it at 60s
/// while its real segments are well inside the limit. Valence no longer passes
/// them over, so neither does this. See VAL-145.
///
/// A closed-GOP source with keyframes every two seconds should never trip it.
#[test]
fn allows_copying_where_the_segments_come_out_a_sensible_length() {
    let fixtures = corpus();

    if fixtures.is_empty() {
        eprintln!("skipping: no corpus. Build it with `pnpm fixtures:sync`.");

        return;
    }

    for path in fixtures {
        let name = name_of(&path);
        let keyframes = keyframes_of(&path);
        let cut = cut_interval(&keyframes, REQUESTED_SEGMENT_SECONDS);

        if name.contains("-closed") && name.contains("8bit") {
            assert!(
                can_copy_segments(&keyframes, cut),
                "{name}: a closed GOP cut every two seconds must be copyable"
            );
        }

        if can_copy_segments(&keyframes, cut) {
            let lengths = segment_lengths(&keyframes, cut);

            assert!(
                longest_segment(&lengths) <= 16.0,
                "{name}: allowed a copy whose longest segment is {:.1}s",
                longest_segment(&lengths)
            );
        }
    }
}

/// A run aimed at a segment writes that segment, not the one before it.
///
/// The rule this exercises is `seek_into`: a seek lands on the last keyframe
/// decoded at or before the time asked for, and a keyframe is decoded before it
/// is shown, so asking for a boundary lands on the keyframe before it and every
/// segment a run writes is one place out. Aiming at the middle cannot overshoot,
/// because the next keyframe is the segment's far edge.
///
/// It was measured on one film, at one segment. This asks it of every fixture
/// that can be copied, at three places in each.
///
/// Asserted for transport streams too, which seek the other way. `-ss` is measured
/// from the file's own start in every container, but MP4 and Matroska round back
/// to the keyframe before the time asked for while MPEG-TS rounds forward to the
/// one after — so the segment a run must be aimed at differs by container, and
/// `seek_into` is told which.
#[test]
fn starts_a_run_at_the_segment_it_was_aimed_at() {
    let fixtures = corpus();

    if fixtures.is_empty() {
        eprintln!("skipping: no corpus. Build it with `pnpm fixtures:sync`.");

        return;
    }

    let scratch = std::env::temp_dir().join(format!("valence-seek-{}", std::process::id()));
    let mut wrong: Vec<String> = Vec::new();

    for path in fixtures {
        let name = name_of(&path);

        if path.extension().is_some_and(|value| value == "webm") {
            continue;
        }

        let seeks_forward = path
            .extension()
            .is_some_and(|value| value == "ts" || value == "m2ts");

        let keyframes = keyframes_of(&path);
        let cut = cut_interval(&keyframes, REQUESTED_SEGMENT_SECONDS);
        let lengths = segment_lengths(&keyframes, cut);
        let starts = segment_starts(&lengths);

        if lengths.len() < 4 {
            continue;
        }

        for index in [1, lengths.len() / 2, lengths.len() - 2] {
            let Some(expected) = starts.get(index).copied() else {
                continue;
            };

            let seek = seek_into(&lengths, index, seeks_forward);
            let Some(written) = first_written_start(&path, cut, seek, &scratch) else {
                continue;
            };

            if (written - expected).abs() > TOLERANCE_SECONDS {
                wrong.push(format!(
                    "{name}: aimed at segment {index} ({expected:.3}) and the run began at {written:.3}"
                ));

                break;
            }
        }
    }

    let _ = std::fs::remove_dir_all(&scratch);

    assert!(
        wrong.is_empty(),
        "runs did not begin where they were aimed:\n{}",
        wrong.join("\n")
    );
}

/// Where the first segment of a seeked run really begins, relative to the film.
///
/// The muxer flags matter and are the ones the real plan passes. Without them the
/// mpegts muxer starts its own clock at 1.4 seconds, and every boundary measured
/// here comes out 1.4 seconds late — which reads exactly like the seek landing in
/// the wrong place.
fn first_written_start(
    path: &Path,
    cut_seconds: f64,
    seek_seconds: f64,
    directory: &Path,
) -> Option<f64> {
    let _ = std::fs::remove_dir_all(directory);
    std::fs::create_dir_all(directory).ok()?;

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error", "-y", "-ss"])
        .arg(format!("{seek_seconds:.6}"))
        .args(["-copyts", "-i"])
        .arg(path)
        .args([
            "-c",
            "copy",
            "-map",
            "0:v:0",
            "-f",
            "hls",
            "-muxdelay",
            "0",
            "-muxpreload",
            "0",
            "-hls_time",
            &format!("{cut_seconds:.6}"),
            "-hls_playlist_type",
            "vod",
            "-hls_list_size",
            "0",
            "-hls_segment_filename",
        ])
        .arg(directory.join("segment%05d.ts"))
        .arg(directory.join("out.m3u8"))
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    let origin = first_pts(&directory.join("segment00000.ts"))?;
    let film_start = keyframes_of(path).starts_at_seconds;

    Some(origin - film_start)
}
