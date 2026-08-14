//! Producing the segment that was asked for.
//!
//! The last piece of ADR-0011's segment addressing. A session no longer runs
//! from where a viewer joined to the end of the film; it produces the segments
//! that are wanted, when they are wanted, and keeps them.
//!
//! Segments are addressed by plan and index, not by where playback started, so
//! seeking backwards into territory already covered costs nothing and seeking
//! forwards costs one short run rather than a new transcode of the remainder.
//!
//! Each run covers a window rather than a single segment, because starting
//! ffmpeg is not free and a viewer who wants segment forty almost certainly
//! wants forty-one. Fragments produced by a run are placed into the film's
//! timeline afterwards, which is what `fragment` exists for.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tokio::process::Command;
use tokio::sync::Mutex;

use crate::fragment::{decode_time_for, set_fragment_positions, track_timescales};
use crate::playlist::segment_name;

/// How many segments a single run covers.
///
/// One would mean starting ffmpeg for every four seconds of film, and a run
/// costs more to start than a segment costs to produce. Too many and a viewer
/// who seeks away has paid for work nobody wanted — which is the fault this
/// whole change exists to remove, so the window stays small.
pub const WINDOW: u32 = 6;

/// The name of the initialisation segment every segment is decoded against.
pub const INIT_NAME: &str = "init.mp4";

/// Where a segment lives, and what it is called.
#[must_use]
pub fn segment_path(directory: &Path, index: u32) -> PathBuf {
    directory.join(segment_name(index as usize))
}

/// Why a segment could not be produced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SegmentError {
    /// ffmpeg would not run at all.
    Spawn(String),
    /// ffmpeg ran and produced nothing usable.
    Failed(String),
    /// The index is past the end of the film.
    OutOfRange,
}

/// Produces segments on demand, once each.
#[derive(Debug, Default, Clone)]
pub struct SegmentRegistry {
    in_flight: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
}

impl SegmentRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    async fn gate(&self, key: &str) -> Arc<Mutex<()>> {
        let mut in_flight = self.in_flight.lock().await;

        Arc::clone(in_flight.entry(key.to_owned()).or_default())
    }

    async fn release(&self, key: &str) {
        let mut in_flight = self.in_flight.lock().await;

        if in_flight
            .get(key)
            .is_some_and(|gate| Arc::strong_count(gate) <= 2)
        {
            in_flight.remove(key);
        }
    }

    /// Makes sure a segment exists, and says where it is.
    ///
    /// Waits rather than duplicating the work when the same window is already
    /// being produced: ten viewers reaching segment forty together should cost
    /// one run, not ten. The gate is keyed on the window rather than the
    /// segment, since a run produces the whole window and a second run for a
    /// neighbouring index would write the same files.
    ///
    /// # Errors
    ///
    /// Returns [`SegmentError::OutOfRange`] for an index past the end of the
    /// film, and the others when ffmpeg would not run or produced nothing.
    pub async fn ensure(
        &self,
        request: &SegmentRequest<'_>,
        index: u32,
    ) -> Result<PathBuf, SegmentError> {
        let path = segment_path(request.directory, index);

        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            return Ok(path);
        }

        if index as usize >= request.lengths.len() {
            return Err(SegmentError::OutOfRange);
        }

        let first = window_start(index);
        let key = format!("{}:{first}", request.directory.to_string_lossy());
        let gate = self.gate(&key).await;
        let _held = gate.lock().await;

        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            self.release(&key).await;

            return Ok(path);
        }

        let outcome = produce(request, first).await;

        self.release(&key).await;

        outcome?;

        if tokio::fs::try_exists(&path).await.unwrap_or(false) {
            Ok(path)
        } else {
            Err(SegmentError::Failed(format!(
                "segment {index} was not written by the run covering it"
            )))
        }
    }
}

/// The first segment of the window an index falls in.
#[must_use]
pub fn window_start(index: u32) -> u32 {
    index - (index % WINDOW)
}

/// Everything producing a segment needs to know.
pub struct SegmentRequest<'a> {
    pub ffmpeg: &'a str,
    pub input_path: &'a str,
    pub directory: &'a Path,
    /// Every segment's length, so an index can be turned into a moment.
    pub lengths: &'a [f64],
    /// The arguments describing what to produce, without input or output.
    pub encode: &'a [String],
}

/// Where a segment begins, in seconds.
#[must_use]
pub fn start_of(lengths: &[f64], index: u32) -> f64 {
    lengths.iter().take(index as usize).sum()
}

/// Runs ffmpeg for one window, then places what it produced.
async fn produce(request: &SegmentRequest<'_>, first: u32) -> Result<(), SegmentError> {
    let start = start_of(request.lengths, first);
    let count = u32::try_from(request.lengths.len()).unwrap_or(u32::MAX);
    let last = (first + WINDOW).min(count);
    let duration: f64 = request.lengths[first as usize..last as usize].iter().sum();

    tokio::fs::create_dir_all(request.directory)
        .await
        .map_err(|error| SegmentError::Spawn(error.to_string()))?;

    let mut arguments: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-loglevel".into(),
        "error".into(),
    ];

    if start > 0.0 {
        arguments.push("-ss".into());
        arguments.push(format!("{start:.6}"));
    }

    arguments.push("-i".into());
    arguments.push(request.input_path.to_owned());
    arguments.push("-t".into());
    arguments.push(format!("{duration:.6}"));
    arguments.extend(request.encode.iter().cloned());

    arguments.extend(
        [
            "-f",
            "hls",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_type",
            "fmp4",
            "-hls_list_size",
            "0",
            "-hls_flags",
            "temp_file",
            "-hls_fmp4_init_filename",
            INIT_NAME,
            "-start_number",
        ]
        .iter()
        .map(|argument| (*argument).to_owned()),
    );

    arguments.push(first.to_string());
    arguments.push("-hls_segment_filename".into());
    arguments.push(
        request
            .directory
            .join("segment%05d.m4s")
            .to_string_lossy()
            .into_owned(),
    );
    arguments.push(
        request
            .directory
            .join(format!("window{first:05}.m3u8"))
            .to_string_lossy()
            .into_owned(),
    );

    let outcome = Command::new(request.ffmpeg)
        .args(&arguments)
        .output()
        .await
        .map_err(|error| SegmentError::Spawn(error.to_string()))?;

    if !outcome.status.success() {
        return Err(SegmentError::Failed(
            String::from_utf8_lossy(&outcome.stderr)
                .lines()
                .last()
                .unwrap_or("ffmpeg said nothing about why")
                .to_owned(),
        ));
    }

    place_window(request, first, last).await
}

/// Moves a window's fragments into the film's timeline.
///
/// A run beginning part way through the film writes fragments that claim to
/// start at nothing, so without this a window past the first displaces the one
/// at the beginning and its frames are silently dropped. See `fragment`.
async fn place_window(
    request: &SegmentRequest<'_>,
    first: u32,
    last: u32,
) -> Result<(), SegmentError> {
    let init = request.directory.join(INIT_NAME);

    let Ok(header) = tokio::fs::read(&init).await else {
        return Err(SegmentError::Failed(
            "no initialisation segment was written".to_owned(),
        ));
    };

    let timescales = track_timescales(&header);

    if timescales.is_empty() {
        return Err(SegmentError::Failed(
            "the initialisation segment named no track timescales".to_owned(),
        ));
    }

    for index in first..last {
        let path = segment_path(request.directory, index);

        let Ok(mut segment) = tokio::fs::read(&path).await else {
            continue;
        };

        let at = start_of(request.lengths, index);
        let starts: HashMap<u32, u64> = timescales
            .iter()
            .map(|(track, timescale)| (*track, decode_time_for(at, *timescale)))
            .collect();

        if set_fragment_positions(&mut segment, &starts) > 0 {
            tokio::fs::write(&path, &segment)
                .await
                .map_err(|error| SegmentError::Failed(error.to_string()))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{segment_path, start_of, window_start, WINDOW};

    #[test]
    fn groups_an_index_into_the_window_that_covers_it() {
        assert_eq!(window_start(0), 0);
        assert_eq!(window_start(WINDOW - 1), 0);
        assert_eq!(window_start(WINDOW), WINDOW);
        assert_eq!(window_start(WINDOW + 1), WINDOW);
    }

    /// Neighbouring segments share a run, which is the point of a window.
    #[test]
    fn gives_neighbours_the_same_window() {
        assert_eq!(window_start(40), window_start(41));
    }

    /// A moment in the film is the sum of everything before it.
    ///
    /// Not index times length: the segments are not equal where the video is
    /// copied, and assuming they are puts every seek past the first wrong.
    #[test]
    fn finds_where_a_segment_begins() {
        let lengths = [13.055, 10.427, 7.132, 10.427];

        assert!((start_of(&lengths, 0) - 0.0).abs() < 0.001);
        assert!((start_of(&lengths, 1) - 13.055).abs() < 0.001);
        assert!((start_of(&lengths, 3) - 30.614).abs() < 0.001);
    }

    #[test]
    fn names_a_segment_after_its_index() {
        let directory = PathBuf::from("/transcodes/abc");

        assert_eq!(
            segment_path(&directory, 42),
            PathBuf::from("/transcodes/abc/segment00042.m4s")
        );
    }
}
