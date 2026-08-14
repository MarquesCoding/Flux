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
/// `-skip_frame nokey` makes ffprobe decode nothing but keyframes, which is
/// what keeps this a pass over the index rather than over the film. It is
/// still a pass: on a six gigabyte remux it is not free, and the result is
/// worth keeping beside the rest of what probing already learns.
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
            "-skip_frame",
            "nokey",
            "-show_entries",
            "frame=pts_time",
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

/// Reads the times out of ffprobe's csv, in order and without the gaps.
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
        .filter_map(|line| line.trim().trim_end_matches(',').parse::<f64>().ok())
        .filter(|time| time.is_finite() && *time >= 0.0)
        .collect();

    times.sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
    times.dedup();

    times
}

/// The segments a source actually yields, given the length asked for.
///
/// Walks the keyframes and takes the first one at or past each multiple of the
/// desired length, so a segment is never shorter than asked for and is only as
/// long as the next cut allows. This is Jellyfin's `ComputeSegments` and it is
/// the same shape for the same reason: the boundaries are not ours to choose.
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

        while next_cut <= last_cut {
            next_cut += desired_seconds;
        }
    }

    let remaining = keyframes.duration_seconds - last_cut;

    if remaining > 0.0 {
        lengths.push(remaining);
    }

    lengths
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
    use super::{parse_keyframe_times, segment_lengths, segment_starts, Keyframes};

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
        let times = parse_keyframe_times("0.0\n13.055\n2.628\n30.614\n23.482\n");

        assert_eq!(times, vec![0.0, 2.628, 13.055, 23.482, 30.614]);
    }

    #[test]
    fn drops_rows_that_are_not_a_time() {
        let times = parse_keyframe_times("0.000000,\nN/A\n\n4.5\n");

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
