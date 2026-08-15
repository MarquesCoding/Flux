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

/// A keyframe a segment can begin at, and where that segment really begins.
///
/// The two are not the same on an open GOP. The muxer cuts in decode order at
/// the keyframe, so the packets that follow it there include leading pictures —
/// frames shown *before* the keyframe but decoded after it. They travel with
/// the segment the keyframe opens, and they carry its earliest presentation
/// time with them.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Cut {
    /// The keyframe's own presentation time.
    ///
    /// What the muxer measures its target against, so this is what decides
    /// which keyframes become cuts.
    pub at_seconds: f64,
    /// The earliest presentation time in the segment beginning here.
    ///
    /// What the playlist has to declare, because it is where the player will
    /// find the segment's media once it has been transmuxed.
    pub starts_at_seconds: f64,
}

/// Where a source can be cut, and how long it runs.
#[derive(Debug, Clone, PartialEq)]
pub struct Keyframes {
    /// Every keyframe, ascending, with the boundary it really produces.
    pub cuts: Vec<Cut>,
    /// The film's earliest presentation time, where its first segment begins.
    pub starts_at_seconds: f64,
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

    Ok(parse_cuts(
        &String::from_utf8_lossy(&output.stdout),
        duration_seconds,
    ))
}

/// Reads where a source can be cut out of ffprobe's csv.
///
/// Each row is a packet: its time, then its flags. `K` marks a keyframe, and
/// only those can begin a segment — every other packet depends on something
/// before it.
///
/// The rows arrive in decode order, which is the order the muxer writes in, so
/// they are walked backwards to find the earliest presentation time still ahead
/// of each keyframe. That is the boundary the keyframe really produces: on an
/// open GOP it sits a few frames before the keyframe's own time, and by a
/// different few for every GOP.
///
/// Measured across five sources — H.264 and HEVC, 8 and 10 bit, MKV and MP4,
/// keyframes two and ten seconds apart — this predicts the start of every
/// segment ffmpeg wrote exactly. The keyframe's own time predicts the closed
/// GOPs and is up to 0.167s out on the open ones, which is the wobble a player
/// turns into a hole at every join. See FLUX-125.
///
/// Sorted rather than trusted, because decode order is not presentation order
/// and a segment list that goes backwards is worse than no segment list at all.
///
/// Rows that are not a number are dropped. ffprobe emits a bare `N/A` for a
/// frame whose timestamp the container never carried, and a trailing empty
/// line for every file.
#[must_use]
pub fn parse_cuts(csv: &str, duration_seconds: f64) -> Keyframes {
    let packets: Vec<(f64, bool)> = csv
        .lines()
        .filter_map(|line| {
            let mut columns = line.trim().split(',');
            let time = columns.next()?.parse::<f64>().ok()?;
            let flags = columns.next().unwrap_or_default();

            (time.is_finite() && time >= 0.0).then_some((time, flags.contains('K')))
        })
        .collect();

    let mut cuts = Vec::new();
    let mut earliest = f64::INFINITY;

    for (time, is_keyframe) in packets.iter().rev() {
        earliest = earliest.min(*time);

        if *is_keyframe {
            cuts.push(Cut {
                at_seconds: *time,
                starts_at_seconds: earliest,
            });
        }
    }

    cuts.sort_by(|left, right| {
        left.at_seconds
            .partial_cmp(&right.at_seconds)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    cuts.dedup_by(|left, right| (left.at_seconds - right.at_seconds).abs() < f64::EPSILON);

    Keyframes {
        cuts,
        starts_at_seconds: if earliest.is_finite() { earliest } else { 0.0 },
        duration_seconds,
    }
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
///
/// Which keyframes become cuts is decided on their own times, because that is
/// what the muxer compares its target against. How long the segments between
/// them are is measured on the boundaries those cuts produce, because that is
/// what the player will find in the media. Keeping the two apart is what lets
/// the lengths be corrected without moving a single cut.
#[must_use]
pub fn segment_lengths(keyframes: &Keyframes, desired_seconds: f64) -> Vec<f64> {
    if desired_seconds <= 0.0 {
        return Vec::new();
    }

    let mut lengths = Vec::new();
    let mut last_start = keyframes.starts_at_seconds;
    let mut next_cut = desired_seconds;

    for cut in &keyframes.cuts {
        if cut.at_seconds < next_cut {
            continue;
        }

        lengths.push(cut.starts_at_seconds - last_start);
        last_start = cut.starts_at_seconds;
        next_cut += desired_seconds;
    }

    let remaining = keyframes.duration_seconds - (last_start - keyframes.starts_at_seconds);

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
        .cuts
        .windows(2)
        .map(|pair| pair[1].at_seconds - pair[0].at_seconds)
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
    use super::{cut_interval, parse_cuts, segment_lengths, segment_starts, Cut, Keyframes};

    /// A source whose segments begin exactly at their keyframes.
    ///
    /// What a closed GOP gives, and what every case that is not about leading
    /// pictures wants to be told.
    fn keyframes(at_seconds: &[f64], duration_seconds: f64) -> Keyframes {
        Keyframes {
            cuts: at_seconds
                .iter()
                .map(|at| Cut {
                    at_seconds: *at,
                    starts_at_seconds: *at,
                })
                .collect(),
            starts_at_seconds: 0.0,
            duration_seconds,
        }
    }

    /// The keyframe times a parse found, for the cases that only care about those.
    fn times_of(keyframes: &Keyframes) -> Vec<f64> {
        keyframes.cuts.iter().map(|cut| cut.at_seconds).collect()
    }

    /// ffprobe answers in decode order, which is not presentation order.
    ///
    /// Measured on a real film: asked for keyframes around the sixteen minute
    /// mark it returned 965.339 before 955.329. A segment list built from that
    /// order goes backwards.
    #[test]
    fn puts_the_keyframes_in_the_order_they_are_watched() {
        let found = parse_cuts("0.0,K__\n13.055,K__\n2.628,K__\n30.614,K__\n", 40.0);

        assert_eq!(times_of(&found), vec![0.0, 2.628, 13.055, 30.614]);
    }

    /// Only a keyframe can begin a segment.
    ///
    /// Every other packet depends on something before it, so cutting there
    /// gives a segment that cannot be decoded on its own.
    #[test]
    fn takes_only_the_packets_a_segment_could_start_at() {
        let found = parse_cuts("0.0,K__\n0.04,___\n0.08,___\n4.0,K__\n", 8.0);

        assert_eq!(times_of(&found), vec![0.0, 4.0]);
    }

    #[test]
    fn drops_rows_that_are_not_a_time() {
        let found = parse_cuts("0.000000,K__\nN/A,K__\n\n4.5,K__\n", 9.0);

        assert_eq!(times_of(&found), vec![0.0, 4.5]);
    }

    /// A closed GOP begins its segment at its keyframe and nowhere else.
    ///
    /// Every packet after the keyframe in decode order is also after it in
    /// presentation, so there is nothing in front of it to pull the boundary
    /// back. Measured on all three H.264 fixtures, which drift by nothing.
    #[test]
    fn begins_a_closed_gop_at_its_keyframe() {
        let found = parse_cuts("0.0,K__\n0.042,___\n0.084,___\n4.0,K__\n4.042,___\n", 8.0);

        assert_eq!(
            found.cuts,
            vec![
                Cut {
                    at_seconds: 0.0,
                    starts_at_seconds: 0.0
                },
                Cut {
                    at_seconds: 4.0,
                    starts_at_seconds: 4.0
                },
            ]
        );
    }

    /// An open GOP begins its segment before its keyframe.
    ///
    /// The two rows after the keyframe are leading pictures: decoded after it,
    /// shown before it. They are written into the segment the keyframe opens,
    /// so the segment's media starts at 3.916 however loudly the keyframe says
    /// 4.0. Declaring 4.0 is what opens a hole at the join.
    #[test]
    fn begins_an_open_gop_before_its_keyframe() {
        let found = parse_cuts(
            "0.0,K__\n0.042,___\n4.0,K__\n3.916,___\n3.958,___\n4.042,___\n",
            8.0,
        );

        assert_eq!(
            found.cuts,
            vec![
                Cut {
                    at_seconds: 0.0,
                    starts_at_seconds: 0.0
                },
                Cut {
                    at_seconds: 4.0,
                    starts_at_seconds: 3.916
                },
            ]
        );
    }

    /// A leading picture belongs to the keyframe it follows, not the one before.
    ///
    /// The running minimum is taken over what is still ahead in decode order,
    /// so a frame shown early cannot reach back past the cut it arrived after
    /// and shorten a segment that was already whole.
    #[test]
    fn does_not_let_a_leading_picture_reach_back_past_an_earlier_cut() {
        let found = parse_cuts("0.0,K__\n4.0,K__\n3.916,___\n8.0,K__\n7.916,___\n", 12.0);

        assert_eq!(
            found
                .cuts
                .iter()
                .map(|cut| cut.starts_at_seconds)
                .collect::<Vec<_>>(),
            vec![0.0, 3.916, 7.916]
        );
    }

    /// The film begins where its earliest frame is shown.
    #[test]
    fn starts_the_film_at_its_earliest_frame() {
        let found = parse_cuts("0.084,K__\n0.0,___\n0.042,___\n4.0,K__\n", 8.0);

        assert!((found.starts_at_seconds - 0.0).abs() < f64::EPSILON);
    }

    /// Leading pictures shorten the segment before them and lengthen their own.
    ///
    /// The lengths still add up to the film, and every one of them is what the
    /// muxer will really write. This is the whole of the FLUX-125 fix.
    #[test]
    fn measures_the_segments_an_open_gop_really_produces() {
        let source = Keyframes {
            cuts: vec![
                Cut {
                    at_seconds: 0.0,
                    starts_at_seconds: 0.0,
                },
                Cut {
                    at_seconds: 2.669,
                    starts_at_seconds: 2.544,
                },
                Cut {
                    at_seconds: 13.096,
                    starts_at_seconds: 12.971,
                },
                Cut {
                    at_seconds: 23.524,
                    starts_at_seconds: 23.357,
                },
            ],
            starts_at_seconds: 0.0,
            duration_seconds: 30.0,
        };

        let lengths = segment_lengths(&source, 1.6893);

        assert_eq!(
            lengths,
            vec![2.544, 12.971 - 2.544, 23.357 - 12.971, 30.0 - 23.357,]
        );

        let total: f64 = lengths.iter().sum();

        assert!((total - 30.0).abs() < 1e-9, "total was {total}");
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
