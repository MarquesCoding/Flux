//! Where a plan's segments fall, worked out once and kept beside them.
//!
//! A playlist that describes the whole film has to name every segment and
//! declare how long each one is, before any of them have been produced. That
//! needs the boundaries, and the boundaries are not free to find: on a copied
//! stream they are the source's own keyframes, read out of its packet index.
//!
//! They belong to the plan rather than to a viewer, so they are computed on
//! the first play of a treatment and read from disk on every one after. Two
//! people watching the same film share the answer, and a service that restarts
//! does not go looking for it again.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::keyframes::{
    cut_interval, grouped_lengths, longest_segment, read_keyframes, segment_groups,
    segment_lengths, Keyframes,
};
use crate::monitor::{record, LogLevel};
use crate::playlist::build_vod_playlist;
use crate::probe::probe_media;
use crate::transcode_plan::{SessionSpec, VideoAction, MANIFEST_NAME};

/// The segment boundaries, cached beside the segments they describe.
pub const LENGTHS_NAME: &str = "lengths.json";

/// The shortest segment worth offering a player as a request of its own.
///
/// Not the length asked for, which is a different question: a segment of three
/// and a half seconds where four were wanted is the ordinary result of cutting
/// on a source's own keyframes and there is nothing wrong with it. This is the
/// point below which a segment costs a whole round trip for a scrap of film,
/// and is better sent along with its neighbour.
const SHORTEST_OFFERED_SEGMENT: f64 = 1.0;

/// What this version of Flux writes into a plan's directory.
///
/// Bumped whenever the segments themselves change shape — a different
/// container, a different way of choosing boundaries — because a directory
/// written by an older Flux describes files that will never be produced now,
/// and a playlist naming them is a film that cannot play. The boundaries are
/// then worked out again and the playlist rewritten, which costs one probe.
const LAYOUT: u32 = 6;

/// The longest segment a copied stream may produce before copying is refused.
///
/// A segment is fetched and appended whole, so its length is also its size. On
/// the measured remux — HEVC Main 10 at 14.5 Mbps — ten second segments are
/// 17.5 megabytes, and Chrome ended the stream on the second one with
/// `QUOTA_EXCEEDED`. Skipping the keyframes a decoder cannot start at makes
/// them longer still: 28, 55, 57 seconds, and 131 at worst.
///
/// Sixteen seconds is four times the length ordinarily asked for. Past it a
/// source is not being delivered as HLS in any useful sense, and encoding —
/// which puts a keyframe on every boundary and yields segments of a few
/// megabytes — is the only thing that plays. See FLUX-125.
const LONGEST_COPYABLE_SEGMENT: f64 = 16.0;

/// Whether a source's own keyframes can yield segments a player will take.
///
/// One way they cannot: keyframes so far apart that the segments between them
/// are more than anything can be asked to fetch and append in one piece. This
/// used to answer yes to any source whose cuts were all safe, without looking
/// at what they produced — so a closed GOP with keyframes a minute apart was
/// copied into minute-long segments. Found by a fixture whose container
/// declared a duration of ninety-nine days.
///
/// It used to refuse a second thing as well: a keyframe carrying pictures shown
/// before it, which a decoder cannot start at on its own. Those were passed
/// over, merging their GOPs into the segment before, and where they ran
/// consecutively the result was segments long enough to fail the length test —
/// so an open-GOP film was encoded in full rather than copied at all. Measured
/// on the Bluray remux that rule was written against: 154 such keyframes, and
/// avoiding them made segments of up to 131.8s.
///
/// That refusal was wrong, and the measurements are worth keeping. A segment
/// only has to be decodable on its own where a decoder starts cold at it, and
/// in fragmented MP4 it does not: the fragments go into one buffer and the
/// decoder runs through them, and a seek still has the fragment before to hand.
/// Both paths were tested against that film with segments deliberately opened on
/// 15 of those keyframes — sequential play lost no frames, and ten seeks landed
/// on frames matching a correct decode of the same instant, worst 7.3 through
/// Chromium and 12.8 through Safari's own HLS, against 70 for unrelated footage.
///
/// Asked by the media service before it starts a session, and by the library
/// scan through the probe, so that both reach the same answer from the same
/// rule. See FLUX-125 and FLUX-145.
#[must_use]
pub fn can_copy_segments(keyframes: &Keyframes, cut_seconds: f64) -> bool {
    longest_segment(&segment_lengths(keyframes, cut_seconds)) <= LONGEST_COPYABLE_SEGMENT
}

/// Where a plan's segments fall, and what the muxer has to be asked for to
/// make them fall there.
///
/// The two belong together: the lengths are what the playlist declares, and
/// they are only what ffmpeg produces if it is asked to cut at the interval
/// worked out beside them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Boundaries {
    /// Which layout of a plan's directory these describe.
    #[serde(default)]
    pub layout: u32,
    /// How long each segment of the film is, in order.
    pub lengths: Vec<f64>,
    /// What to pass the muxer as its segment length.
    pub cut_seconds: f64,
    /// Whether a seek in this source lands after the time asked for.
    ///
    /// True for transport streams, which round forward to the next keyframe
    /// where MP4 and Matroska round back to the previous one. It decides which
    /// segment a run has to be aimed at to begin at the one wanted.
    #[serde(default)]
    pub seeks_forward: bool,
    /// Whether this source can be delivered by copying it at all.
    ///
    /// False when its own keyframes cannot yield segments a player will take:
    /// either they are places a decoder cannot start, or avoiding those makes
    /// the segments far too long. The lengths then describe an encode, because
    /// that is the only way the film plays.
    pub can_copy: bool,
    /// How many of the lengths above make up each segment the playlist offers.
    ///
    /// One apiece for everything but a copied source whose keyframes crowd
    /// together, where a few of the muxer's segments are too short to be worth
    /// a request of their own and are offered together instead. Empty for
    /// boundaries written before Flux grouped anything, which are read as one
    /// apiece.
    #[serde(default)]
    pub groups: Vec<u32>,
}

impl Boundaries {
    /// Whether anything could be worked out at all.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.lengths.is_empty()
    }

    /// How many of the muxer's segments make up each one the playlist offers.
    ///
    /// One apiece for boundaries cached before Flux grouped anything, which
    /// carry none and describe a playlist that offered every segment alone.
    ///
    /// The counts are checked against the segments they claim to cover rather
    /// than trusted. Comparing how many groups there are against how many
    /// segments there are is the wrong question and was asked here first: the
    /// two are equal only when nothing was gathered, so grouping was thrown
    /// away in exactly the case it had done some work. What has to match is the
    /// total.
    #[must_use]
    pub fn grouping(&self) -> Vec<u32> {
        let covered: usize = self
            .groups
            .iter()
            .map(|count| usize::try_from(*count).unwrap_or(usize::MAX))
            .sum();

        if !self.groups.is_empty() && covered == self.lengths.len() {
            return self.groups.clone();
        }

        vec![1; self.lengths.len()]
    }

    /// The length of each segment the playlist offers.
    #[must_use]
    pub fn offered_lengths(&self) -> Vec<f64> {
        grouped_lengths(&self.lengths, &self.grouping())
    }

    /// Nothing, for a source that could not be read.
    #[must_use]
    fn unknown() -> Self {
        Self {
            layout: LAYOUT,
            lengths: Vec::new(),
            cut_seconds: 0.0,
            seeks_forward: false,
            can_copy: true,
            groups: Vec::new(),
        }
    }
}

/// The segments an encode produces, which are the length that was asked for.
///
/// `-force_key_frames` puts a keyframe on every boundary, so unlike a copied
/// stream there is nothing to discover: the muxer cuts where it was told to.
/// The last segment is whatever is left, which is shorter than the rest and is
/// still a segment.
#[must_use]
pub fn equal_lengths(duration_seconds: f64, segment_seconds: u32) -> Vec<f64> {
    let wanted = f64::from(segment_seconds.max(1));

    if !duration_seconds.is_finite() || duration_seconds <= 0.0 {
        return Vec::new();
    }

    let mut lengths = Vec::new();
    let mut covered = 0.0;

    while duration_seconds - covered > wanted {
        lengths.push(wanted);
        covered += wanted;
    }

    lengths.push(duration_seconds - covered);

    lengths
}

/// Reads boundaries a previous play of this plan already worked out.
async fn cached_boundaries(directory: &Path) -> Option<Boundaries> {
    let payload = tokio::fs::read_to_string(directory.join(LENGTHS_NAME))
        .await
        .ok()?;

    let found: Boundaries = serde_json::from_str(&payload).ok()?;

    (!found.is_empty() && found.layout == LAYOUT).then_some(found)
}

/// Whether a seek in this container lands after the time asked for.
///
/// Transport streams round forward to the next keyframe; MP4 and Matroska round
/// back to the previous one. Measured across H.264 and HEVC transport streams
/// with keyframes two and five seconds apart, which agree. See FLUX-132.
#[must_use]
fn seeks_forward(container: crate::media::Container) -> bool {
    matches!(
        container,
        crate::media::Container::Ts | crate::media::Container::M2ts
    )
}

/// Works out where every segment of a plan begins and ends.
///
/// Encoded video cuts where Flux tells it to. Copied video cuts where the
/// source allows, which is what the keyframes say — and if they cannot be read,
/// equal lengths are a worse answer than the truth but a better one than
/// refusing to play the film.
async fn compute_boundaries(ffprobe: &str, spec: &SessionSpec) -> Boundaries {
    let path = Path::new(&spec.input_path);
    let wanted = f64::from(spec.segment_seconds.max(1));

    let Ok(probe) = probe_media(ffprobe, path).await else {
        return Boundaries::unknown();
    };

    let seeks_forward = seeks_forward(probe.container);

    let equal = |can_copy: bool| {
        let lengths = equal_lengths(probe.duration_seconds, spec.segment_seconds);

        Boundaries {
            layout: LAYOUT,
            groups: vec![1; lengths.len()],
            lengths,
            cut_seconds: wanted,
            seeks_forward,
            can_copy,
        }
    };

    if matches!(spec.video, VideoAction::Encode { .. }) {
        return equal(true);
    }

    match read_keyframes(ffprobe, path, probe.duration_seconds).await {
        Ok(keyframes) => {
            let cut_seconds = cut_interval(&keyframes, wanted);
            let unsafe_cuts = keyframes.cuts.iter().filter(|cut| !cut.is_safe()).count();
            let lengths = segment_lengths(&keyframes, cut_seconds);

            if unsafe_cuts > 0 {
                record(
                    LogLevel::Info,
                    "transcode",
                    &format!(
                        "{} opens {unsafe_cuts} of its segments on a keyframe with leading \
pictures, which is copied anyway",
                        spec.input_path
                    ),
                );
            }

            Boundaries {
                layout: LAYOUT,
                groups: segment_groups(&lengths, SHORTEST_OFFERED_SEGMENT),
                lengths,
                cut_seconds,
                seeks_forward,
                can_copy: true,
            }
        }

        Err(failure) => {
            record(
                LogLevel::Warn,
                "transcode",
                &format!(
                    "could not read the keyframes of {}: {failure}",
                    spec.input_path
                ),
            );

            equal(true)
        }
    }
}

/// The boundaries of this plan's segments, computing them if nobody has yet.
///
/// Writes the playlist as well, because the two are the same fact: the lengths
/// are what the playlist declares, and a playlist written from anything else
/// would be a promise the segments break.
///
/// An empty answer means the source could not be read at all, which the caller
/// should refuse to start a session over rather than serve a playlist naming
/// nothing.
/// Throws away segments that describe a film this plan no longer produces.
///
/// Boundaries are only worked out afresh when none were cached, which means
/// either nothing has played this yet or the ones on disk were written by a
/// Flux that cut differently. In the second case every segment beside them is
/// the wrong length and the completion marker is a lie: a source that used to
/// be copied in ten second pieces and is now encoded in four second ones would
/// otherwise serve the old pieces against the new playlist, or serve nothing at
/// all because the directory claims to be finished.
///
/// The names are positional, so a stale `segment00001.ts` is indistinguishable
/// from a fresh one by anything except what wrote it. Removing them costs the
/// transcode again and is the only way to be sure.
async fn discard_segments(directory: &Path) {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return;
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name = name.to_string_lossy();

        if name.starts_with("segment") || name == crate::session::COMPLETE_MARKER {
            let _ = tokio::fs::remove_file(entry.path()).await;
        }
    }
}

pub async fn ensure_boundaries(ffprobe: &str, directory: &Path, spec: &SessionSpec) -> Boundaries {
    if let Some(found) = cached_boundaries(directory).await {
        return found;
    }

    let found = compute_boundaries(ffprobe, spec).await;

    if found.is_empty() {
        return found;
    }

    discard_segments(directory).await;

    if let Ok(payload) = serde_json::to_string(&found) {
        let _ = tokio::fs::write(directory.join(LENGTHS_NAME), payload).await;
    }

    let _ = tokio::fs::write(
        directory.join(MANIFEST_NAME),
        build_vod_playlist(&found.offered_lengths(), spec.container),
    )
    .await;

    found
}

#[cfg(test)]
mod tests {
    use super::{can_copy_segments, equal_lengths, Boundaries, LAYOUT};
    use crate::keyframes::{Cut, Keyframes};

    fn grouped(lengths: Vec<f64>, groups: Vec<u32>) -> Boundaries {
        Boundaries {
            layout: LAYOUT,
            lengths,
            cut_seconds: 0.0747,
            seeks_forward: false,
            can_copy: true,
            groups,
        }
    }

    /// The case the first attempt threw away, which was every case that mattered.
    ///
    /// Grouping is only ever recorded when it gathered something, so there are
    /// always fewer groups than segments. Reading it back has to survive that.
    #[test]
    fn keeps_a_grouping_that_gathered_something() {
        let found = grouped(vec![3.5, 0.083, 3.4], vec![1, 2]);

        assert_eq!(found.grouping(), vec![1, 2]);
        assert_eq!(found.offered_lengths(), vec![3.5, 3.483]);
    }

    #[test]
    fn offers_every_segment_alone_where_nothing_was_grouped() {
        let found = grouped(vec![4.0, 4.0], Vec::new());

        assert_eq!(found.grouping(), vec![1, 1]);
        assert_eq!(found.offered_lengths(), vec![4.0, 4.0]);
    }

    /// A grouping that does not add up describes segments that are not there.
    #[test]
    fn refuses_a_grouping_that_does_not_cover_the_film() {
        let found = grouped(vec![4.0, 4.0, 4.0], vec![1, 1]);

        assert_eq!(found.grouping(), vec![1, 1, 1]);
    }

    fn every(seconds: f64, count: u32, duration: f64) -> Keyframes {
        Keyframes {
            cuts: (0..count)
                .map(|index| {
                    let at = f64::from(index) * seconds;

                    Cut {
                        at_seconds: at,
                        starts_at_seconds: at,
                    }
                })
                .collect(),
            starts_at_seconds: 0.0,
            duration_seconds: duration,
        }
    }

    /// Keyframes close enough together to fetch one segment at a time.
    #[test]
    fn copies_a_source_whose_keyframes_are_close_together() {
        assert!(can_copy_segments(&every(4.0, 15, 60.0), 4.0));
    }

    /// Safe cuts are not on their own enough.
    ///
    /// This answered yes to any source whose cuts were all safe, without
    /// looking at what they produced, so a closed GOP with keyframes a minute
    /// apart was copied into minute-long segments — the size the limit exists
    /// An open GOP is no longer a reason to encode a whole film.
    ///
    /// A keyframe carrying pictures shown before it cannot be started at cold,
    /// and every one of these is. It is still copied: in fragmented MP4 the
    /// fragments go into one buffer and the decoder runs through them, and a
    /// seek has the fragment before it to hand. Measured on the film this rule
    /// was written against — sequential play lost no frames with 15 of 24
    /// segments opened on such a keyframe, and ten seeks onto them landed on
    /// frames matching a correct decode, through Chromium and through Safari's
    /// own HLS alike. See FLUX-145.
    #[test]
    fn copies_a_source_whose_keyframes_carry_leading_pictures() {
        let mut open_gop = every(4.0, 15, 60.0);

        for cut in &mut open_gop.cuts {
            cut.starts_at_seconds = cut.at_seconds - 0.25;
        }

        assert!(open_gop.cuts.iter().all(|cut| !cut.is_safe()));
        assert!(can_copy_segments(&open_gop, 4.0));
    }

    /// to prevent, whatever put it there. See FLUX-132.
    #[test]
    fn refuses_a_source_whose_safe_keyframes_are_still_too_far_apart() {
        assert!(!can_copy_segments(&every(60.0, 5, 300.0), 4.0));
    }

    /// A container that declares nonsense is refused rather than believed.
    #[test]
    fn refuses_a_source_whose_duration_is_not_credible() {
        assert!(!can_copy_segments(&every(0.0, 1, 8_589_935.0), 4.0));
    }

    /// An encode cuts where it is told to, so the segments are what was asked.
    #[test]
    fn cuts_an_encode_where_it_was_asked_to() {
        assert_eq!(equal_lengths(12.0, 4), vec![4.0, 4.0, 4.0]);
    }

    /// The tail is a segment even though it is shorter than the rest.
    #[test]
    fn keeps_what_is_left_over_as_a_segment() {
        assert_eq!(equal_lengths(10.0, 4), vec![4.0, 4.0, 2.0]);
    }

    /// A film shorter than one segment is one segment.
    #[test]
    fn makes_one_segment_of_a_film_shorter_than_one() {
        assert_eq!(equal_lengths(3.0, 4), vec![3.0]);
    }

    /// A duration nothing could read is no segments, not a segment of nothing.
    #[test]
    fn describes_nothing_when_the_duration_is_unusable() {
        assert!(equal_lengths(0.0, 4).is_empty());
        assert!(equal_lengths(f64::NAN, 4).is_empty());
    }

    /// The lengths have to add up to the film, or the seek bar lies.
    #[test]
    fn covers_the_whole_film() {
        let total: f64 = equal_lengths(296.045_996, 4).iter().sum();

        assert!((total - 296.045_996).abs() < 1e-9, "total was {total}");
    }
}
