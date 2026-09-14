//! The playlist Valence writes for itself.
//!
//! Today ffmpeg's HLS muxer writes it, growing an `EVENT` playlist as segments
//! appear. That makes the playlist a report of what has been transcoded rather
//! than a description of the film: a viewer can only seek within what has
//! already been written, and seeking past it starts a whole new transcode from
//! there, which must not happen.
//!
//! Segments are fragmented MP4 unless a client cannot take them. Transport
//! streams were the one global answer for a while, because a copied open-GOP
//! HEVC film stopped twenty-three seconds in as fragmented MP4 — but that was
//! the segments opening on a CRA whose leading pictures reference the GOP
//! before them, not the container. Those cuts are refused before a copy is
//! agreed to, so what reaches the muxer starts where a decoder can. Measured
//! against the same film: HEVC Main 10 in fragmented MP4 plays every frame.
//! See [`crate::keyframes::Cut::is_safe`], VAL-114 and VAL-124.
//!
//! A `VOD` playlist covering the whole film says where every segment is before
//! any of them exist. The player can then ask for any one of them, and the
//! service's job becomes producing the segment that was asked for rather than
//! racing through the film in order.
//!
//! Building it needs the segment lengths, which is what `keyframes` works out.

use std::fmt::Write as _;

use crate::transcode_plan::{SegmentContainer, INIT_SEGMENT_NAME};

/// The HLS version a playlist of this container needs.
///
/// Seven for fragmented MP4, which is the version that admits it as a segment
/// type. Three for transport streams, which carry their own timing and need no
/// `EXT-X-MAP` to point at an initialisation segment. Claiming a higher version
/// than the features used is how a playlist becomes something an older player
/// refuses for no reason.
#[must_use]
fn playlist_version(container: SegmentContainer) -> u8 {
    match container {
        SegmentContainer::Fmp4 => 7,
        SegmentContainer::MpegTs => 3,
    }
}

/// The longest a segment could sensibly be, in seconds.
///
/// A day. Not a limit anything should reach — it exists so the target duration
/// is a bounded number rather than whatever a corrupt duration produced, and so
/// converting it to an integer cannot misrepresent anything.
const LONGEST_SENSIBLE_SEGMENT: f64 = 86_400.0;

/// Builds a VOD playlist for a film whose segments are already worked out.
///
/// `lengths` come from the keyframes, so they are what the segments will
/// actually be rather than what was asked for. Declaring the requested length
/// instead would be a lie the player discovers one segment in, and a seek bar
/// that lands somewhere other than where it was dropped.
///
/// The names are positional — `segment00000.m4s` — because a segment is
/// addressed by its index, and the index is how a request for a moment in the
/// film is turned back into work to do.
#[must_use]
pub fn build_vod_playlist(lengths: &[f64], container: SegmentContainer) -> String {
    let mut playlist = String::with_capacity(96 + lengths.len() * 48);

    playlist.push_str("#EXTM3U\n");
    let _ = writeln!(playlist, "#EXT-X-VERSION:{}", playlist_version(container));
    playlist.push_str("#EXT-X-PLAYLIST-TYPE:VOD\n");
    let _ = writeln!(
        playlist,
        "#EXT-X-TARGETDURATION:{}",
        target_duration(lengths)
    );
    playlist.push_str("#EXT-X-MEDIA-SEQUENCE:0\n");

    if container.needs_init_segment() {
        let _ = writeln!(playlist, "#EXT-X-MAP:URI=\"{INIT_SEGMENT_NAME}\"");
    }

    for (index, length) in lengths.iter().enumerate() {
        let _ = writeln!(playlist, "#EXTINF:{length:.6},");
        let _ = writeln!(playlist, "{}", segment_name(index, container));
    }

    playlist.push_str("#EXT-X-ENDLIST\n");

    playlist
}

/// The longest segment, rounded up, which is what the tag has to carry.
///
/// A player may refuse a playlist whose `EXT-X-TARGETDURATION` is smaller than
/// a segment it later meets, and on a copied stream the segments are as long as
/// the source's keyframes make them — thirteen seconds where four were asked
/// for, on the film this was written against.
#[must_use]
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "clamped to a whole number of seconds between one and a day, which no cast can misrepresent"
)]
pub fn target_duration(lengths: &[f64]) -> u64 {
    let longest = lengths
        .iter()
        .copied()
        .filter(|length| length.is_finite())
        .fold(0.0_f64, f64::max)
        .ceil()
        .clamp(1.0, LONGEST_SENSIBLE_SEGMENT);

    longest as u64
}

/// What the segment at an index is called.
///
/// Matches `-hls_segment_filename segment%05d.<ext>`, so a playlist Valence writes
/// and segments ffmpeg writes agree on names without either being told.
#[must_use]
pub fn segment_name(index: usize, container: SegmentContainer) -> String {
    format!("segment{index:05}.{}", container.extension())
}

/// Which segment covers a moment in the film.
///
/// A seek arrives as a time and has to become an index. Returns the last
/// segment beginning at or before that time, so a seek inside a segment plays
/// from its start — the only place it can, since that is where the keyframe is.
#[must_use]
pub fn segment_at(lengths: &[f64], seconds: f64) -> Option<usize> {
    if lengths.is_empty() || seconds < 0.0 {
        return None;
    }

    let mut start = 0.0;

    for (index, length) in lengths.iter().enumerate() {
        let end = start + length;

        if seconds < end {
            return Some(index);
        }

        start = end;
    }

    Some(lengths.len() - 1)
}

#[cfg(test)]
mod tests {
    use super::{build_vod_playlist, segment_at, segment_name, target_duration};
    use crate::transcode_plan::SegmentContainer;

    #[test]
    fn names_segments_the_way_ffmpeg_does() {
        assert_eq!(segment_name(0, SegmentContainer::Fmp4), "segment00000.m4s");
        assert_eq!(segment_name(42, SegmentContainer::Fmp4), "segment00042.m4s");
        assert_eq!(
            segment_name(12345, SegmentContainer::Fmp4),
            "segment12345.m4s"
        );
    }

    /// A client that cannot take fragmented MP4 gets transport streams.
    #[test]
    fn names_transport_stream_segments_by_their_own_extension() {
        assert_eq!(segment_name(0, SegmentContainer::MpegTs), "segment00000.ts");
        assert_eq!(
            segment_name(42, SegmentContainer::MpegTs),
            "segment00042.ts"
        );
    }

    /// The tag has to be at least the longest segment.
    #[test]
    fn declares_a_target_the_longest_segment_fits_in() {
        assert_eq!(target_duration(&[13.055, 10.427, 7.132]), 14);
        assert_eq!(target_duration(&[4.0, 4.0]), 4);
    }

    /// An empty film still needs a number the player will accept.
    #[test]
    fn never_declares_a_target_of_nothing() {
        assert_eq!(target_duration(&[]), 1);
    }

    /// The whole film, before any of it has been transcoded.
    #[test]
    fn describes_every_segment_up_front() {
        let playlist = build_vod_playlist(&[13.055, 10.427, 7.132], SegmentContainer::Fmp4);

        assert!(playlist.starts_with("#EXTM3U\n"));
        assert!(playlist.contains("#EXT-X-PLAYLIST-TYPE:VOD\n"));
        assert!(playlist.ends_with("#EXT-X-ENDLIST\n"));
        assert_eq!(playlist.matches("#EXTINF:").count(), 3);
    }

    /// Fragmented MP4 segments are undecodable without the initialisation
    /// segment, so the playlist has to point at it before naming any of them.
    #[test]
    fn points_a_fragmented_playlist_at_its_initialisation_segment() {
        let playlist = build_vod_playlist(&[4.0, 4.0], SegmentContainer::Fmp4);

        assert!(playlist.contains("#EXT-X-VERSION:7\n"), "{playlist}");
        assert!(
            playlist.contains("#EXT-X-MAP:URI=\"init.mp4\"\n"),
            "{playlist}"
        );

        let map = playlist.find("#EXT-X-MAP").expect("declares the map");
        let first = playlist.find("#EXTINF").expect("names a segment");

        assert!(map < first, "the map has to precede every segment");
    }

    /// A transport stream carries its own timing, so there is nothing to point
    /// at and no reason to demand a version that admits fragmented MP4.
    #[test]
    fn declares_no_initialisation_segment_for_transport_streams() {
        let playlist = build_vod_playlist(&[4.0, 4.0], SegmentContainer::MpegTs);

        assert!(playlist.contains("#EXT-X-VERSION:3\n"), "{playlist}");
        assert!(!playlist.contains("#EXT-X-MAP"), "{playlist}");
        assert_eq!(playlist.matches(".ts\n").count(), 2);
    }

    /// The lengths declared are the ones the segments will really be.
    ///
    /// Repeating the requested four seconds would be a lie the player finds
    /// out about one segment in.
    #[test]
    fn declares_the_lengths_the_segments_actually_are() {
        let playlist = build_vod_playlist(&[13.055, 10.427], SegmentContainer::Fmp4);

        assert!(playlist.contains("#EXTINF:13.055000,\nsegment00000.m4s\n"));
        assert!(playlist.contains("#EXTINF:10.427000,\nsegment00001.m4s\n"));
    }

    /// A seek is a time, and the work is addressed by index.
    #[test]
    fn turns_a_moment_in_the_film_into_a_segment() {
        let lengths = [13.055, 10.427, 7.132];

        assert_eq!(segment_at(&lengths, 0.0), Some(0));
        assert_eq!(segment_at(&lengths, 13.0), Some(0));
        assert_eq!(segment_at(&lengths, 13.055), Some(1));
        assert_eq!(segment_at(&lengths, 24.0), Some(2));
    }

    /// Past the end is the last segment, not nothing.
    #[test]
    fn holds_a_seek_past_the_end_at_the_last_segment() {
        assert_eq!(segment_at(&[4.0, 4.0], 99.0), Some(1));
    }

    #[test]
    fn has_no_segment_for_a_film_with_none() {
        assert_eq!(segment_at(&[], 0.0), None);
    }

    /// The playlist a real film produces, end to end.
    ///
    /// These are the lengths measured from the Bluray remux this work exists
    /// for — keyframes ten to thirteen seconds apart against a request for
    /// four second segments.
    #[test]
    fn builds_the_playlist_the_measured_film_needs() {
        let lengths = [13.055, 10.427, 7.132, 10.427];
        let playlist = build_vod_playlist(&lengths, SegmentContainer::Fmp4);

        assert!(
            playlist.contains("#EXT-X-TARGETDURATION:14\n"),
            "the longest segment is 13.055 and the tag must cover it:\n{playlist}"
        );
        assert_eq!(playlist.matches(".m4s\n").count(), lengths.len());
    }
}
