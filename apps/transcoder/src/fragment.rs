//! Placing a fragment in the film it came from.
//!
//! ffmpeg writes an fMP4 fragment's timestamps relative to the run that
//! produced it, not to the film. A segment cut from a run that began at fifty
//! seconds claims to start at zero, whatever `-ss`, `-copyts`,
//! `-output_ts_offset` and `-start_at_zero` are asked to do — all four were
//! measured and none of them move it.
//!
//! That matters because segments have to be producible from anywhere for
//! seeking to stop restarting the film. Mixing one run's segments with
//! another's is not a cosmetic fault: a playlist of six ten-second segments
//! whose last came from a separate run decoded 1250 frames where 1500 were
//! expected, because the last one claimed a place another already held. The
//! playlist read as sixty seconds, ffprobe agreed, and ten seconds of film
//! were simply absent.
//!
//! The position lives in one field — `moof.traf.tfdt.baseMediaDecodeTime` —
//! and writing it is enough. Patched, the same playlist decoded all 1500.
//!
//! The alternative was MPEG-TS segments, which carry their own timestamps and
//! would have avoided this. It was rejected: AV1 and VP9 can only be carried in
//! fMP4, and HEVC very nearly so, which would have turned every remux in a
//! library of HEVC into a re-encode. See FLUX-114 and FLUX-115.

use std::collections::HashMap;
use std::hash::BuildHasher;

/// A box header: what it is, where it starts, and how far it runs.
struct BoxHeader {
    kind: [u8; 4],
    end: usize,
    payload: usize,
}

/// Walks the boxes directly inside a range, without descending.
///
/// Bounds are checked against the range rather than trusted from the file, so
/// a truncated or malformed fragment stops the walk instead of reading past
/// the end of it.
fn children(data: &[u8], from: usize, to: usize) -> Vec<BoxHeader> {
    let mut found = Vec::new();
    let mut at = from;

    while at + 8 <= to {
        let size =
            u32::from_be_bytes([data[at], data[at + 1], data[at + 2], data[at + 3]]) as usize;
        let kind = [data[at + 4], data[at + 5], data[at + 6], data[at + 7]];

        let size = if size == 0 { to - at } else { size };

        if size < 8 || at + size > to {
            break;
        }

        found.push(BoxHeader {
            kind,
            end: at + size,
            payload: at + 8,
        });

        at += size;
    }

    found
}

/// Finds a box of one kind among the children of a range.
fn child(boxes: &[BoxHeader], kind: [u8; 4]) -> Option<&BoxHeader> {
    boxes.iter().find(|found| found.kind == kind)
}

/// The track a fragment belongs to, from its `tfhd`.
fn track_of(data: &[u8], traf: &BoxHeader) -> Option<u32> {
    let boxes = children(data, traf.payload, traf.end);
    let tfhd = child(&boxes, *b"tfhd")?;
    let at = tfhd.payload + 4;

    (at + 4 <= tfhd.end)
        .then(|| u32::from_be_bytes([data[at], data[at + 1], data[at + 2], data[at + 3]]))
}

/// Writes where each fragment sits in the film.
///
/// `starts` gives the position for each track, already in that track's own
/// timescale — video and audio do not share one, and a fragment carries no
/// timescale of its own to convert with. Reading them from the initialisation
/// segment is the caller's job, since it holds them once for every segment.
///
/// A track with no entry is left alone rather than guessed at. Returns how
/// many fragments were placed, so a caller can tell "nothing needed doing"
/// from "nothing was understood".
pub fn set_fragment_positions<S: BuildHasher>(
    segment: &mut [u8],
    starts: &HashMap<u32, u64, S>,
) -> usize {
    let length = segment.len();
    let mut placed = 0;

    for moof in children(segment, 0, length) {
        if moof.kind != *b"moof" {
            continue;
        }

        for traf in children(segment, moof.payload, moof.end) {
            if traf.kind != *b"traf" {
                continue;
            }

            let Some(track) = track_of(segment, &traf) else {
                continue;
            };

            let Some(start) = starts.get(&track) else {
                continue;
            };

            let boxes = children(segment, traf.payload, traf.end);

            let Some(tfdt) = child(&boxes, *b"tfdt") else {
                continue;
            };

            if write_decode_time(segment, tfdt, *start) {
                placed += 1;
            }
        }
    }

    placed
}

/// Puts a decode time into a `tfdt`, in whichever width it was written.
///
/// Version one holds sixty-four bits and version nought thirty-two. The width
/// is not ours to choose: it is what the box already declares, and rewriting
/// it would move every byte after it.
fn write_decode_time(segment: &mut [u8], tfdt: &BoxHeader, start: u64) -> bool {
    let version = segment[tfdt.payload];
    let at = tfdt.payload + 4;

    match version {
        1 if at + 8 <= tfdt.end => {
            segment[at..at + 8].copy_from_slice(&start.to_be_bytes());

            true
        }
        0 if at + 4 <= tfdt.end => {
            let Ok(narrowed) = u32::try_from(start) else {
                return false;
            };

            segment[at..at + 4].copy_from_slice(&narrowed.to_be_bytes());

            true
        }
        _ => false,
    }
}

/// Reads where each fragment currently claims to be.
///
/// For checking what was written, and for telling a segment that is already in
/// the right place from one that needs moving.
#[must_use]
pub fn fragment_positions(segment: &[u8]) -> HashMap<u32, u64> {
    let mut found = HashMap::new();

    for moof in children(segment, 0, segment.len()) {
        if moof.kind != *b"moof" {
            continue;
        }

        for traf in children(segment, moof.payload, moof.end) {
            if traf.kind != *b"traf" {
                continue;
            }

            let Some(track) = track_of(segment, &traf) else {
                continue;
            };

            let boxes = children(segment, traf.payload, traf.end);

            let Some(tfdt) = child(&boxes, *b"tfdt") else {
                continue;
            };

            let version = segment[tfdt.payload];
            let at = tfdt.payload + 4;

            let value = match version {
                1 if at + 8 <= tfdt.end => u64::from_be_bytes([
                    segment[at],
                    segment[at + 1],
                    segment[at + 2],
                    segment[at + 3],
                    segment[at + 4],
                    segment[at + 5],
                    segment[at + 6],
                    segment[at + 7],
                ]),
                0 if at + 4 <= tfdt.end => u64::from(u32::from_be_bytes([
                    segment[at],
                    segment[at + 1],
                    segment[at + 2],
                    segment[at + 3],
                ])),
                _ => continue,
            };

            found.insert(track, value);
        }
    }

    found
}

/// Each track's timescale, read from an initialisation segment.
///
/// Video and audio are counted in different units — 12800 and 48000 a second
/// on the film this was written against — so a position in seconds cannot be
/// turned into a decode time without knowing which track it is for.
#[must_use]
pub fn track_timescales(init: &[u8]) -> HashMap<u32, u32> {
    let mut found = HashMap::new();
    let length = init.len();

    let Some(moov) = children(init, 0, length)
        .into_iter()
        .find(|found| found.kind == *b"moov")
    else {
        return found;
    };

    for trak in children(init, moov.payload, moov.end) {
        if trak.kind != *b"trak" {
            continue;
        }

        let inside = children(init, trak.payload, trak.end);

        let Some(track) = child(&inside, *b"tkhd").and_then(|tkhd| track_id(init, tkhd)) else {
            continue;
        };

        let Some(timescale) = child(&inside, *b"mdia")
            .map(|mdia| children(init, mdia.payload, mdia.end))
            .as_deref()
            .and_then(|boxes| child(boxes, *b"mdhd"))
            .and_then(|mdhd| timescale_of(init, mdhd))
        else {
            continue;
        };

        found.insert(track, timescale);
    }

    found
}

/// The track's number, whose place in `tkhd` depends on the box's version.
fn track_id(init: &[u8], tkhd: &BoxHeader) -> Option<u32> {
    let version = init[tkhd.payload];
    let at = tkhd.payload + 4 + if version == 1 { 16 } else { 8 };

    (at + 4 <= tkhd.end)
        .then(|| u32::from_be_bytes([init[at], init[at + 1], init[at + 2], init[at + 3]]))
}

/// The track's timescale, likewise placed by version.
fn timescale_of(init: &[u8], mdhd: &BoxHeader) -> Option<u32> {
    let version = init[mdhd.payload];
    let at = mdhd.payload + 4 + if version == 1 { 16 } else { 8 };

    (at + 4 <= mdhd.end)
        .then(|| u32::from_be_bytes([init[at], init[at + 1], init[at + 2], init[at + 3]]))
}

/// Where a segment beginning at this moment should claim to be.
///
/// Rounded rather than truncated: a segment boundary is a keyframe's exact
/// presentation time, and losing the fraction moves it by up to a tick.
/// The largest decode time worth entertaining.
///
/// A thousand hours at a megahertz. Not a limit any film reaches — it is here
/// so the conversion from seconds is a bounded number rather than whatever a
/// corrupt duration produced.
const LARGEST_SENSIBLE_TICKS: f64 = 3_600_000_000_000.0;

#[must_use]
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "clamped to a bounded, non-negative tick count before the cast"
)]
pub fn decode_time_for(start_seconds: f64, timescale: u32) -> u64 {
    if !start_seconds.is_finite() || start_seconds <= 0.0 {
        return 0;
    }

    let ticks = start_seconds * f64::from(timescale);

    ticks.round().clamp(0.0, LARGEST_SENSIBLE_TICKS) as u64
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{decode_time_for, fragment_positions, set_fragment_positions};

    /// Builds a fragment with one `moof.traf` carrying a version one `tfdt`.
    fn fragment(track: u32, decode_time: u64) -> Vec<u8> {
        let mut tfhd = Vec::new();
        tfhd.extend_from_slice(&20_u32.to_be_bytes());
        tfhd.extend_from_slice(b"tfhd");
        tfhd.extend_from_slice(&0_u32.to_be_bytes());
        tfhd.extend_from_slice(&track.to_be_bytes());
        tfhd.extend_from_slice(&0_u32.to_be_bytes());

        let mut tfdt = Vec::new();
        tfdt.extend_from_slice(&20_u32.to_be_bytes());
        tfdt.extend_from_slice(b"tfdt");
        tfdt.extend_from_slice(&0x0100_0000_u32.to_be_bytes());
        tfdt.extend_from_slice(&decode_time.to_be_bytes());

        let mut traf = Vec::new();
        traf.extend_from_slice(
            &u32::try_from(8 + tfhd.len() + tfdt.len())
                .unwrap()
                .to_be_bytes(),
        );
        traf.extend_from_slice(b"traf");
        traf.extend_from_slice(&tfhd);
        traf.extend_from_slice(&tfdt);

        let mut moof = Vec::new();
        moof.extend_from_slice(&u32::try_from(8 + traf.len()).unwrap().to_be_bytes());
        moof.extend_from_slice(b"moof");
        moof.extend_from_slice(&traf);

        moof
    }

    #[test]
    fn reads_where_a_fragment_claims_to_be() {
        let segment = fragment(1, 640_000);

        assert_eq!(fragment_positions(&segment).get(&1), Some(&640_000));
    }

    /// The whole point: a fragment produced elsewhere is moved into place.
    #[test]
    fn places_a_fragment_in_the_film_it_came_from() {
        let mut segment = fragment(1, 0);
        let starts = HashMap::from([(1, 640_000)]);

        assert_eq!(set_fragment_positions(&mut segment, &starts), 1);
        assert_eq!(fragment_positions(&segment).get(&1), Some(&640_000));
    }

    /// A track nobody gave a position for is left as it was.
    ///
    /// Guessing would be worse than leaving it: a wrong position is a segment
    /// that silently displaces another, which is the fault this exists to fix.
    #[test]
    fn leaves_a_track_it_was_told_nothing_about() {
        let mut segment = fragment(2, 1234);

        assert_eq!(set_fragment_positions(&mut segment, &HashMap::new()), 0);
        assert_eq!(fragment_positions(&segment).get(&2), Some(&1234));
    }

    /// Rewriting must not move any byte but the one it is writing.
    #[test]
    fn changes_nothing_but_the_position() {
        let before = fragment(1, 0);
        let mut after = before.clone();

        set_fragment_positions(&mut after, &HashMap::from([(1, 999)]));

        assert_eq!(before.len(), after.len());
        assert_eq!(before[..24], after[..24]);
    }

    /// Truncated input stops the walk rather than reading past the end.
    #[test]
    fn refuses_to_read_beyond_a_short_fragment() {
        let full = fragment(1, 0);
        let mut cut = full[..full.len() - 6].to_vec();

        assert_eq!(
            set_fragment_positions(&mut cut, &HashMap::from([(1, 5)])),
            0
        );
    }

    #[test]
    fn survives_something_that_is_not_a_fragment_at_all() {
        let mut nonsense = b"this is not an mp4 at all, not even close".to_vec();

        assert_eq!(
            set_fragment_positions(&mut nonsense, &HashMap::from([(1, 5)])),
            0
        );
        assert!(fragment_positions(&nonsense).is_empty());
    }

    /// The measured film: video counts at 12800 a second, audio at 48000.
    #[test]
    fn converts_a_moment_using_the_track_that_measures_it() {
        assert_eq!(decode_time_for(50.0, 12_800), 640_000);
        assert_eq!(decode_time_for(50.0, 48_000), 2_400_000);
    }

    /// A boundary is a keyframe's exact time, and the fraction matters.
    #[test]
    fn keeps_the_fraction_of_a_boundary() {
        assert_eq!(decode_time_for(13.055, 12_800), 167_104);
    }

    #[test]
    fn places_the_start_of_the_film_at_nothing() {
        assert_eq!(decode_time_for(0.0, 12_800), 0);
        assert_eq!(decode_time_for(-1.0, 12_800), 0);
    }
}
