//! Where a film can be cut, and where its segments therefore fall.
//!
//! A segment has to begin at a keyframe. When Flux encodes it puts them where
//! it likes, so segments come out the length they were asked to be. When Flux
//! copies the video it has no such freedom: the keyframes are whatever the
//! source shipped with, and `-hls_time` is a request the muxer cannot honour.
//!
//! Measured on a Bluray remux of HEVC Main 10, keyframes ten to thirteen
//! seconds apart: a request for four second segments produced segments of
//! 13.2, 6.2, 6.0, 2.5, 7.9 and 7.6 seconds, and a fourteen megabyte first
//! segment that a browser has to fetch before it can show anything.
//!
//! The answer is not to force an encode. It is to know where the cuts actually
//! land and to say so, which is what ADR-0011's segment addressing needs and
//! what Jellyfin does for the same case.

use std::path::Path;

use tokio::process::Command;

use crate::probe::ProbeError;

/// Where a source can be cut, and how long it runs.
#[derive(Debug, Clone, PartialEq)]
pub struct Keyframes {
    /// Every keyframe's presentation time, in seconds, ascending.
    pub at_seconds: Vec<f64>,
    /// How long the film runs, so the last segment has an end.
    pub duration_seconds: f64,
}

/// Reads every keyframe position out of a file.
///
/// From the container's packet index rather than by decoding. `-skip_frame
/// nokey` sounds like the cheaper option and is not: it decodes, and on a six
/// gigabyte remux it took **twenty-two seconds** where reading the index takes
/// **under one**. A viewer pressing play waited for the difference, and read it
/// as the player having hung.
///
/// The index is also the better answer. It found 1444 keyframes on that film
/// where decoding found 1389, and a packet's keyframe flag is what actually
/// decides whether a segment can begin there.
///
/// # Errors
///
/// Returns [`ProbeError::Failed`] when ffprobe will not read the file, and
/// [`ProbeError::Process`] when it cannot be run at all.
pub async fn read_keyframes(
    ffprobe: &str,
    path: &Path,
    duration_seconds: f64,
) -> Result<Keyframes, ProbeError> {
    let output = Command::new(ffprobe)
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
        .await?;

    if !output.status.success() {
        return Err(ProbeError::Failed {
            status: output.status.code().unwrap_or(-1),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }

    Ok(Keyframes {
        at_seconds: parse_keyframe_times(&String::from_utf8_lossy(&output.stdout)),
        duration_seconds,
    })
}

/// Reads the keyframe times out of ffprobe's csv, in order and without gaps.
///
/// Each row is a packet: its time, then its flags. `K` marks a keyframe, and
/// only those can begin a segment — every other packet depends on something
/// before it.
///
/// Sorted rather than trusted: asked for frames, ffprobe answers in decode
/// order, and with B-frames that is not presentation order. A segment list
/// that goes backwards is worse than no segment list at all.
///
/// Rows that are not a number are dropped. ffprobe emits a bare `N/A` for a
/// frame whose timestamp the container never carried, and a trailing empty
/// line for every file.
#[must_use]
pub fn parse_keyframe_times(csv: &str) -> Vec<f64> {
    let mut times: Vec<f64> = csv
        .lines()
        .filter_map(|line| {
            let mut columns = line.trim().split(',');
            let time = columns.next()?;
            let flags = columns.next().unwrap_or_default();

            flags.contains('K').then(|| time.parse::<f64>().ok())?
        })
        .filter(|time| time.is_finite() && *time >= 0.0)
        .collect();

    times.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    times.dedup();

    times
}

/// The segments a source actually yields, given the length asked for.
///
/// Walks the keyframes and cuts at the first one that reaches the muxer's
/// target, which advances by exactly one segment length per cut and is
/// therefore left behind whenever a cut lands late. A source whose keyframes
/// are ten seconds apart puts the target four seconds further on and the film
/// ten, so after a few segments the target is minutes behind and every
/// keyframe becomes a cut.
///
/// That is not a rule anybody would choose. It is `hlsenc.c`'s, and the
/// playlist has to describe what ffmpeg will really write rather than what
/// would be tidy. Catching the target up to the last cut — which is the
/// obvious reading, and what this did — predicted the film's first seventeen
/// segments exactly and then drifted: 621 seconds declared against 497 seconds
/// produced across 94 segments, so the playlist ran out before the film did
/// and every seek landed further from where it was dropped. Following the
/// muxer instead matches all 94.
///
/// The result is what the playlist must declare. Declaring the requested
/// length instead would be a lie the player discovers one segment in.
#[must_use]
pub fn segment_lengths(keyframes: &Keyframes, desired_seconds: f64) -> Vec<f64> {
    if desired_seconds <= 0.0 {
        return Vec::new();
    }

    let mut lengths = Vec::new();
    let mut last_cut = 0.0;
    let mut next_cut = desired_seconds;

    for keyframe in &keyframes.at_seconds {
        if *keyframe < next_cut {
            continue;
        }

        lengths.push(keyframe - last_cut);
        last_cut = *keyframe;
        next_cut += desired_seconds;
    }

    let remaining = keyframes.duration_seconds - last_cut;

    if remaining > 0.0 {
        lengths.push(remaining);
    }

    lengths
}

/// What to ask the muxer for, so that where it cuts does not depend on where
/// the run started.
///
/// The muxer's target advances by one segment length per cut and never catches
/// up, so a run walking through the whole film and a run restarted part way
/// through it hold different targets in the same place and cut differently.
/// Measured on the Bluray remux: a run restarted at segment 596 agreed with a
/// run from the beginning for nine segments and then diverged, and one
/// restarted at segment 400 diverged immediately — so after a seek the
/// playlist described a film the transcode was no longer producing.
///
/// Asking for less than the closest pair of keyframes takes the target out of
/// it: every keyframe then satisfies it, so every run cuts at every keyframe
/// wherever it began. Segments come out as long as the source allows, which is
/// what a copied stream was always going to give.
///
/// Never more than was asked for, so a source with keyframes further apart than
/// the requested length still gets the request rather than a longer segment.
#[must_use]
pub fn cut_interval(keyframes: &Keyframes, requested_seconds: f64) -> f64 {
    let closest = keyframes
        .at_seconds
        .windows(2)
        .map(|pair| pair[1] - pair[0])
        .filter(|gap| *gap > 0.0)
        .fold(f64::INFINITY, f64::min);

    if !closest.is_finite() {
        return requested_seconds;
    }

    requested_seconds.min(closest * 0.9)
}

/// Where each segment begins, which is what producing one on demand needs.
///
/// A segment is addressed by its index, so turning that index back into a
/// place in the film is the whole point of knowing the boundaries.
#[must_use]
pub fn segment_starts(lengths: &[f64]) -> Vec<f64> {
    let mut starts = Vec::with_capacity(lengths.len());
    let mut at = 0.0;

    for length in lengths {
        starts.push(at);
        at += length;
    }

    starts
}

#[cfg(test)]
mod tests {
    use super::{cut_interval, parse_keyframe_times, segment_lengths, segment_starts, Keyframes};

    fn keyframes(at_seconds: &[f64], duration_seconds: f64) -> Keyframes {
        Keyframes {
            at_seconds: at_seconds.to_vec(),
            duration_seconds,
        }
    }

    /// ffprobe answers in decode order, which is not presentation order.
    ///
    /// Measured on a real film: asked for keyframes around the sixteen minute
    /// mark it returned 965.339 before 955.329. A segment list built from that
    /// order goes backwards.
    #[test]
    fn puts_the_keyframes_in_the_order_they_are_watched() {
        let times = parse_keyframe_times("0.0,K__\n13.055,K__\n2.628,K__\n30.614,K__\n");

        assert_eq!(times, vec![0.0, 2.628, 13.055, 30.614]);
    }

    /// Only a keyframe can begin a segment.
    ///
    /// Every other packet depends on something before it, so cutting there
    /// gives a segment that cannot be decoded on its own.
    #[test]
    fn takes_only_the_packets_a_segment_could_start_at() {
        let times = parse_keyframe_times("0.0,K__\n0.04,___\n0.08,___\n4.0,K__\n");

        assert_eq!(times, vec![0.0, 4.0]);
    }

    #[test]
    fn drops_rows_that_are_not_a_time() {
        let times = parse_keyframe_times("0.000000,K__\nN/A,K__\n\n4.5,K__\n");

        assert_eq!(times, vec![0.0, 4.5]);
    }

    /// Where Flux chose the keyframes, the segments are what was asked for.
    #[test]
    fn cuts_where_asked_when_the_keyframes_allow_it() {
        let source = keyframes(&[0.0, 4.0, 8.0, 12.0, 16.0], 20.0);

        assert_eq!(segment_lengths(&source, 4.0), vec![4.0, 4.0, 4.0, 4.0, 4.0]);
    }

    /// The real film this was written for.
    ///
    /// Keyframes ten to thirteen seconds apart, four second segments asked
    /// for. Nothing can make these four seconds long, and the playlist has to
    /// say so rather than repeat the request back.
    #[test]
    fn tells_the_truth_about_a_source_with_sparse_keyframes() {
        let source = keyframes(&[0.0, 2.628, 13.055, 23.482, 30.614, 41.041], 50.0);

        let lengths = segment_lengths(&source, 4.0);

        assert_eq!(
            lengths,
            vec![
                13.055,
                23.482 - 13.055,
                30.614 - 23.482,
                41.041 - 30.614,
                50.0 - 41.041,
            ]
        );
        assert!(
            lengths.iter().all(|length| *length > 4.0),
            "no segment can be shorter than the gap between keyframes: {lengths:?}"
        );
    }

    /// Asking for less than the closest keyframes are makes every keyframe a
    /// cut, whatever the run has done before.
    #[test]
    fn asks_for_less_than_the_closest_keyframes_are() {
        let source = keyframes(&[0.0, 10.0, 20.0, 21.0, 22.0], 30.0);

        let interval = cut_interval(&source, 4.0);

        assert!((interval - 0.9).abs() < 1e-9, "interval was {interval}");
        assert_eq!(
            segment_lengths(&source, interval),
            vec![10.0, 10.0, 1.0, 1.0, 8.0]
        );
    }

    /// A source cut less often than asked for still gets what was asked for.
    #[test]
    fn never_asks_for_more_than_the_length_wanted() {
        let source = keyframes(&[0.0, 60.0, 120.0], 180.0);

        assert!((cut_interval(&source, 4.0) - 4.0).abs() < f64::EPSILON);
    }

    /// A film with one keyframe has no pair to measure.
    #[test]
    fn asks_for_what_was_wanted_when_there_is_nothing_to_measure() {
        assert!((cut_interval(&keyframes(&[0.0], 30.0), 4.0) - 4.0).abs() < f64::EPSILON);
    }

    /// The measured film: keyframes never closer than 0.959 seconds, so the
    /// muxer is asked for 0.863 and cuts at all 1444 of them.
    #[test]
    fn asks_the_measured_film_for_less_than_its_closest_keyframes() {
        let source = keyframes(&[0.0, 2.628, 13.055, 14.014, 24.441], 30.0);

        let interval = cut_interval(&source, 4.0);
        let lengths = segment_lengths(&source, interval);
        let wanted = [2.628, 10.427, 0.959, 10.427, 30.0 - 24.441];

        assert!((interval - 0.863_1).abs() < 1e-9, "interval was {interval}");
        assert_eq!(lengths.len(), wanted.len(), "lengths were {lengths:?}");
        assert!(
            lengths
                .iter()
                .zip(wanted)
                .all(|(found, expected)| (found - expected).abs() < 1e-6),
            "lengths were {lengths:?}"
        );
    }

    /// Once the muxer's target falls behind, every keyframe is a cut.
    ///
    /// The target moves four seconds per segment while a film with sparse
    /// keyframes moves ten, so it ends up minutes behind and stops holding
    /// anything back. Measured on the Bluray remux: from its eighteenth
    /// segment on, ffmpeg's own playlist is the raw gaps between keyframes —
    /// 1.876, 10.428, 10.427, 8.216, 6.382 — and a prediction that expected
    /// four second segments there described a different film.
    #[test]
    fn cuts_at_every_keyframe_once_the_target_is_left_behind() {
        let source = keyframes(&[0.0, 10.0, 20.0, 21.0, 22.0], 30.0);

        assert_eq!(
            segment_lengths(&source, 4.0),
            vec![10.0, 10.0, 1.0, 1.0, 8.0]
        );
    }

    /// A keyframe before the first cut is not a cut.
    ///
    /// The one at 2.628 is passed over because a segment that short is not
    /// what was asked for, and the next boundary is the first at or past four.
    #[test]
    fn does_not_cut_earlier_than_asked() {
        let source = keyframes(&[0.0, 2.628, 13.055], 20.0);

        assert_eq!(segment_lengths(&source, 4.0), vec![13.055, 20.0 - 13.055]);
    }

    /// The tail is a segment even though no keyframe ends it.
    #[test]
    fn keeps_what_is_left_after_the_last_cut() {
        let source = keyframes(&[0.0, 4.0, 8.0], 11.0);

        assert_eq!(segment_lengths(&source, 4.0), vec![4.0, 4.0, 3.0]);
    }

    /// A film with no keyframes at all is one segment, not none.
    #[test]
    fn makes_one_segment_of_a_source_it_cannot_cut() {
        let source = keyframes(&[], 42.0);

        assert_eq!(segment_lengths(&source, 4.0), vec![42.0]);
    }

    #[test]
    fn turns_lengths_into_the_places_they_begin() {
        assert_eq!(
            segment_starts(&[13.055, 10.427, 7.132]),
            vec![0.0, 13.055, 13.055 + 10.427]
        );
    }

    /// The starts are what an index is resolved through, so they have to line
    /// up with the lengths exactly.
    #[test]
    fn gives_every_segment_a_start() {
        let source = keyframes(&[0.0, 2.628, 13.055, 23.482, 30.614], 40.0);
        let lengths = segment_lengths(&source, 4.0);

        assert_eq!(segment_starts(&lengths).len(), lengths.len());
    }
}
