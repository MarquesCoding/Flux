//! Seek-bar preview images.
//!
//! A viewer scrubbing a two hour film wants to see where they are landing. The
//! only way to answer that instantly is to have decoded the frames in advance,
//! so Flux renders one small image every few seconds into tiled sheets and
//! indexes them with `WebVTT`, which every player already understands.
//!
//! Sheets rather than one file per thumbnail: a film of two hours at one frame
//! every ten seconds is 720 images, and 720 requests to draw one hover is a
//! worse trade than four sheet downloads.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::process::Command;

/// Written only when every sheet is on disk.
///
/// Same reasoning as a transcode session: a directory holding sheets is not
/// proof they are all there, because a killed ffmpeg leaves a partial tile
/// grid that looks finished.
const COMPLETE_MARKER: &str = ".complete";

/// The index a player reads.
pub const INDEX_NAME: &str = "thumbnails.vtt";

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrickplayRequest {
    pub input_path: String,
    /// Seconds between thumbnails.
    pub interval_seconds: u32,
    /// Width of a single thumbnail in pixels. Height follows the source.
    pub tile_width: u32,
    /// Thumbnails across one sheet.
    pub columns: u32,
    /// Thumbnails down one sheet.
    pub rows: u32,
}

impl Default for TrickplayRequest {
    fn default() -> Self {
        Self {
            input_path: String::new(),
            // Ten seconds is roughly where Jellyfin and Plex sit: fine enough
            // to be useful when scrubbing, coarse enough that a film costs
            // seconds of decoding rather than minutes.
            interval_seconds: 10,
            tile_width: 320,
            columns: 10,
            rows: 10,
        }
    }
}

/// Where the thumbnails ended up.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrickplayIndex {
    pub id: String,
    pub interval_seconds: u32,
    pub tile_width: u32,
    pub tile_height: u32,
    pub columns: u32,
    pub rows: u32,
    /// Sheet file names, in time order.
    pub sheets: Vec<String>,
    /// Path the player fetches the `WebVTT` index from.
    pub index: String,
}

/// Why thumbnails could not be made.
#[derive(Debug, Error)]
pub enum TrickplayError {
    #[error("the request asks for no thumbnails")]
    EmptyRequest,
    #[error("could not create the thumbnail directory: {0}")]
    Directory(std::io::Error),
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg produced no thumbnails: {0}")]
    NoOutput(String),
    #[error("could not write the thumbnail index: {0}")]
    Index(std::io::Error),
}

impl TrickplayRequest {
    /// A stable identifier for this exact request.
    ///
    /// Content addressed like a transcode session, so asking twice reuses the
    /// sheets rather than decoding the film again.
    #[must_use]
    pub fn id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(self.input_path.as_bytes());
        hasher.update(self.interval_seconds.to_be_bytes());
        hasher.update(self.tile_width.to_be_bytes());
        hasher.update(self.columns.to_be_bytes());
        hasher.update(self.rows.to_be_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            let _ = write!(id, "{byte:02x}");
        }

        id
    }
}

/// Scales a thumbnail to the source's shape.
///
/// Rounded to an even number because JPEG chroma subsampling works in pairs of
/// pixels, and an odd height makes ffmpeg refuse the filter chain outright.
#[must_use]
pub fn tile_height_for(tile_width: u32, source_width: u32, source_height: u32) -> u32 {
    if source_width == 0 || source_height == 0 {
        return tile_width * 9 / 16;
    }

    let scaled = (u64::from(tile_width) * u64::from(source_height)) / u64::from(source_width);
    let even = u32::try_from(scaled).unwrap_or(tile_width * 9 / 16) & !1;

    even.max(2)
}

/// How many thumbnails a piece of media of this length needs.
#[must_use]
pub fn thumbnail_count(duration_seconds: f64, interval_seconds: u32) -> u32 {
    if interval_seconds == 0 || duration_seconds <= 0.0 {
        return 0;
    }

    let count = (duration_seconds / f64::from(interval_seconds)).ceil();

    if count.is_finite() && count >= 1.0 {
        u32::try_from(count as u64).unwrap_or(u32::MAX)
    } else {
        0
    }
}

/// The ffmpeg arguments that render the sheets.
///
/// One decode pass drives both the sampling and the tiling, so the file is
/// read once. `fps` before `scale` means the expensive resize only runs on the
/// frames that survive.
#[must_use]
pub fn sheet_arguments(
    request: &TrickplayRequest,
    tile_height: u32,
    directory: &Path,
) -> Vec<String> {
    let filter = format!(
        "fps=1/{interval},scale={width}:{height},tile={columns}x{rows}",
        interval = request.interval_seconds,
        width = request.tile_width,
        height = tile_height,
        columns = request.columns,
        rows = request.rows,
    );

    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-i".to_owned(),
        request.input_path.clone(),
        "-vf".to_owned(),
        filter,
        "-an".to_owned(),
        "-sn".to_owned(),
        "-qscale:v".to_owned(),
        "5".to_owned(),
        directory.join("sheet-%03d.jpg").to_string_lossy().into(),
    ]
}

/// Builds the `WebVTT` index.
///
/// Each cue points at a rectangle inside a sheet through the `#xywh` fragment,
/// which is how players are told where a thumbnail sits without downloading
/// anything else to find out.
#[must_use]
pub fn build_index(request: &TrickplayRequest, tile_height: u32, count: u32) -> String {
    let per_sheet = request.columns * request.rows;
    let mut vtt = String::from("WEBVTT\n\n");

    if per_sheet == 0 {
        return vtt;
    }

    for index in 0..count {
        let start = index * request.interval_seconds;
        let end = start + request.interval_seconds;
        let sheet = index / per_sheet;
        let within = index % per_sheet;
        let x = (within % request.columns) * request.tile_width;
        let y = (within / request.columns) * tile_height;

        let _ = writeln!(
            vtt,
            "{} --> {}\nsheet-{:03}.jpg#xywh={},{},{},{}\n",
            format_timestamp(start),
            format_timestamp(end),
            sheet + 1,
            x,
            y,
            request.tile_width,
            tile_height,
        );
    }

    vtt
}

/// Formats seconds as the `hh:mm:ss.mmm` `WebVTT` insists on.
#[must_use]
pub fn format_timestamp(seconds: u32) -> String {
    format!(
        "{:02}:{:02}:{:02}.000",
        seconds / 3600,
        (seconds % 3600) / 60,
        seconds % 60
    )
}

/// Whether this set of thumbnails already exists.
async fn is_already_complete(directory: &Path) -> bool {
    tokio::fs::try_exists(directory.join(COMPLETE_MARKER))
        .await
        .unwrap_or(false)
}

/// Reads the sheet names on disk, in time order.
async fn list_sheets(directory: &Path) -> Vec<String> {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return Vec::new();
    };

    let mut names = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.ends_with(".jpg") {
            names.push(name);
        }
    }

    names.sort();

    names
}

/// Renders the sheets and the index, or reuses what is already there.
///
/// # Errors
///
/// Returns [`TrickplayError`] when the directory cannot be made, ffmpeg cannot
/// be started, it writes no sheets, or the index cannot be saved.
pub async fn generate(
    ffmpeg: &str,
    cache_root: &Path,
    request: &TrickplayRequest,
    source_width: u32,
    source_height: u32,
    duration_seconds: f64,
) -> Result<TrickplayIndex, TrickplayError> {
    let tile_height = tile_height_for(request.tile_width, source_width, source_height);
    let count = thumbnail_count(duration_seconds, request.interval_seconds);

    if count == 0 || request.columns == 0 || request.rows == 0 {
        return Err(TrickplayError::EmptyRequest);
    }

    let id = request.id();
    let directory = cache_root.join("trickplay").join(&id);

    let finish = |sheets: Vec<String>| TrickplayIndex {
        interval_seconds: request.interval_seconds,
        tile_width: request.tile_width,
        tile_height,
        columns: request.columns,
        rows: request.rows,
        index: format!("/trickplay/{id}/{INDEX_NAME}"),
        id: id.clone(),
        sheets,
    };

    if is_already_complete(&directory).await {
        return Ok(finish(list_sheets(&directory).await));
    }

    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(TrickplayError::Directory)?;

    let output = Command::new(ffmpeg)
        .args(sheet_arguments(request, tile_height, &directory))
        .output()
        .await
        .map_err(TrickplayError::Spawn)?;

    let sheets = list_sheets(&directory).await;

    if sheets.is_empty() {
        return Err(TrickplayError::NoOutput(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }

    tokio::fs::write(
        directory.join(INDEX_NAME),
        build_index(request, tile_height, count),
    )
    .await
    .map_err(TrickplayError::Index)?;

    tokio::fs::write(directory.join(COMPLETE_MARKER), b"")
        .await
        .map_err(TrickplayError::Index)?;

    Ok(finish(sheets))
}

/// Where a generated set of thumbnails lives.
#[must_use]
pub fn directory_for(cache_root: &Path, id: &str) -> PathBuf {
    cache_root.join("trickplay").join(id)
}

#[cfg(test)]
mod tests {
    use super::{
        build_index, format_timestamp, sheet_arguments, thumbnail_count, tile_height_for,
        TrickplayRequest,
    };
    use std::path::Path;

    fn request() -> TrickplayRequest {
        TrickplayRequest {
            input_path: "/media/film.mkv".to_owned(),
            interval_seconds: 10,
            tile_width: 320,
            columns: 2,
            rows: 2,
        }
    }

    #[test]
    fn tile_height_follows_the_source_shape() {
        assert_eq!(tile_height_for(320, 1920, 1080), 180);
    }

    #[test]
    fn tile_height_is_always_even() {
        assert_eq!(tile_height_for(320, 1920, 1079) % 2, 0);
    }

    #[test]
    fn tile_height_falls_back_when_the_source_is_unknown() {
        assert_eq!(tile_height_for(320, 0, 0), 180);
    }

    #[test]
    fn a_two_hour_film_at_ten_seconds_needs_seven_hundred_and_twenty_thumbnails() {
        assert_eq!(thumbnail_count(7200.0, 10), 720);
    }

    #[test]
    fn a_partial_interval_still_gets_a_thumbnail() {
        assert_eq!(thumbnail_count(25.0, 10), 3);
    }

    #[test]
    fn nothing_is_generated_for_media_of_no_length() {
        assert_eq!(thumbnail_count(0.0, 10), 0);
    }

    #[test]
    fn an_interval_of_zero_is_refused_rather_than_dividing_by_it() {
        assert_eq!(thumbnail_count(100.0, 0), 0);
    }

    #[test]
    fn the_same_request_addresses_the_same_thumbnails() {
        assert_eq!(request().id(), request().id());
    }

    #[test]
    fn a_different_interval_addresses_different_thumbnails() {
        let coarse = TrickplayRequest {
            interval_seconds: 20,
            ..request()
        };

        assert_ne!(request().id(), coarse.id());
    }

    #[test]
    fn sampling_happens_before_scaling_so_only_kept_frames_are_resized() {
        let arguments = sheet_arguments(&request(), 180, Path::new("/cache"));
        let filter = arguments
            .iter()
            .position(|argument| argument == "-vf")
            .and_then(|index| arguments.get(index + 1))
            .expect("the filter chain is passed");

        assert_eq!(filter, "fps=1/10,scale=320:180,tile=2x2");
    }

    #[test]
    fn audio_and_subtitles_are_dropped_from_the_thumbnail_pass() {
        let arguments = sheet_arguments(&request(), 180, Path::new("/cache"));

        assert!(arguments.iter().any(|argument| argument == "-an"));
        assert!(arguments.iter().any(|argument| argument == "-sn"));
    }

    #[test]
    fn timestamps_are_written_the_way_webvtt_demands() {
        assert_eq!(format_timestamp(3725), "01:02:05.000");
    }

    #[test]
    fn every_thumbnail_gets_a_cue() {
        let vtt = build_index(&request(), 180, 4);

        assert_eq!(vtt.matches("#xywh=").count(), 4);
    }

    #[test]
    fn cues_walk_across_a_sheet_before_moving_down_it() {
        let vtt = build_index(&request(), 180, 4);

        assert!(vtt.contains("sheet-001.jpg#xywh=0,0,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=320,0,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=0,180,320,180"));
        assert!(vtt.contains("sheet-001.jpg#xywh=320,180,320,180"));
    }

    #[test]
    fn a_full_sheet_rolls_over_to_the_next_one() {
        let vtt = build_index(&request(), 180, 5);

        assert!(vtt.contains("sheet-002.jpg#xywh=0,0,320,180"));
    }

    #[test]
    fn cue_times_follow_the_sampling_interval() {
        let vtt = build_index(&request(), 180, 2);

        assert!(vtt.contains("00:00:00.000 --> 00:00:10.000"));
        assert!(vtt.contains("00:00:10.000 --> 00:00:20.000"));
    }

    #[test]
    fn the_index_declares_itself_as_webvtt() {
        assert!(build_index(&request(), 180, 1).starts_with("WEBVTT\n"));
    }
}
