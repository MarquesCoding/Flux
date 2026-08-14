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

use crate::keyframes::{cut_interval, read_keyframes, segment_lengths};
use crate::playlist::build_vod_playlist;
use crate::probe::probe_media;
use crate::transcode_plan::{SessionSpec, VideoAction, INIT_SEGMENT_NAME, MANIFEST_NAME};

/// The segment boundaries, cached beside the segments they describe.
pub const LENGTHS_NAME: &str = "lengths.json";

/// Where a plan's segments fall, and what the muxer has to be asked for to
/// make them fall there.
///
/// The two belong together: the lengths are what the playlist declares, and
/// they are only what ffmpeg produces if it is asked to cut at the interval
/// worked out beside them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Boundaries {
    /// How long each segment of the film is, in order.
    pub lengths: Vec<f64>,
    /// What to pass the muxer as its segment length.
    pub cut_seconds: f64,
}

impl Boundaries {
    /// Whether anything could be worked out at all.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.lengths.is_empty()
    }

    /// Nothing, for a source that could not be read.
    #[must_use]
    fn unknown() -> Self {
        Self {
            lengths: Vec::new(),
            cut_seconds: 0.0,
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

    (!found.is_empty()).then_some(found)
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

    let equal = || Boundaries {
        lengths: equal_lengths(probe.duration_seconds, spec.segment_seconds),
        cut_seconds: wanted,
    };

    if matches!(spec.video, VideoAction::Encode { .. }) {
        return equal();
    }

    match read_keyframes(ffprobe, path, probe.duration_seconds).await {
        Ok(keyframes) => {
            let cut_seconds = cut_interval(&keyframes, wanted);

            Boundaries {
                lengths: segment_lengths(&keyframes, cut_seconds),
                cut_seconds,
            }
        }
        Err(failure) => {
            eprintln!(
                "transcode: could not read the keyframes of {}: {failure}",
                spec.input_path
            );

            equal()
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
pub async fn ensure_boundaries(ffprobe: &str, directory: &Path, spec: &SessionSpec) -> Boundaries {
    if let Some(found) = cached_boundaries(directory).await {
        return found;
    }

    let found = compute_boundaries(ffprobe, spec).await;

    if found.is_empty() {
        return found;
    }

    if let Ok(payload) = serde_json::to_string(&found) {
        let _ = tokio::fs::write(directory.join(LENGTHS_NAME), payload).await;
    }

    let _ = tokio::fs::write(
        directory.join(MANIFEST_NAME),
        build_vod_playlist(&found.lengths, INIT_SEGMENT_NAME),
    )
    .await;

    found
}

#[cfg(test)]
mod tests {
    use super::equal_lengths;

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
