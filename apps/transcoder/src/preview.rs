//! Short silent-by-default clips a library page can play.
//!
//! A hero that autoplays and a row of cards that play on hover are, taken
//! literally, half a dozen transcodes running at once to show people what a
//! film looks like. That is the wrong shape of work: the machine has a limit
//! on how many streams it will produce, and spending it on decoration means
//! the one somebody is actually watching goes without.
//!
//! So a preview is made once, when a file enters the library, and served as a
//! plain file afterwards. It costs a few seconds of encoding and a couple of
//! megabytes, and it can be played by any number of browsers at once because
//! nothing is running behind it.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::process::Command;

use crate::media::VideoRange;
use crate::transcode_plan::{tone_map_filter, ToneMapping};

/// The file a preview is written to.
pub const PREVIEW_NAME: &str = "preview.mp4";

/// Written only when the clip is whole.
const COMPLETE_MARKER: &str = ".complete";

/// How long a preview runs.
///
/// Long enough to show what a film looks and sounds like, short enough that
/// nobody is watching it instead of pressing play.
const DEFAULT_SECONDS: u32 = 24;

/// Where in a film to take it from, as a fraction of the running time.
///
/// The opening of anything is a distributor's logo on black.
const DEFAULT_POSITION: f64 = 0.2;

/// How wide a preview is.
///
/// Full height rather than a thumbnail. A preview fills a hero across the
/// whole width of a desktop, and anything smaller is visibly soft there — the
/// clip is made once and kept, so the few extra seconds and megabytes buy a
/// picture that does not look worse than the film it is advertising.
const DEFAULT_WIDTH: u32 = 1920;

/// How hard the encoder tries.
///
/// Low enough that a still from the clip stands next to a still from the file
/// without embarrassing itself.
const QUALITY: &str = "20";

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequest {
    pub input_path: String,
    /// Where to start, in seconds. Absent means a fifth of the way in.
    #[serde(default)]
    pub at_seconds: Option<u32>,
    #[serde(default = "default_seconds")]
    pub duration_seconds: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    /// Whether the caller will wait for the encode to finish.
    #[serde(default)]
    pub wait: bool,
}

const fn default_seconds() -> u32 {
    DEFAULT_SECONDS
}

const fn default_width() -> u32 {
    DEFAULT_WIDTH
}

/// Where a preview ended up.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewClip {
    pub id: String,
    /// Path the player fetches the clip from.
    pub url: String,
    pub is_ready: bool,
}

/// Why a preview could not be made.
#[derive(Debug, Error)]
pub enum PreviewError {
    #[error("could not create the preview directory: {0}")]
    Directory(std::io::Error),
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg produced no clip: {0}")]
    NoOutput(String),
    #[error("could not mark the preview complete: {0}")]
    Marker(std::io::Error),
}

impl PreviewRequest {
    /// A stable identifier for this exact clip.
    ///
    /// Content addressed like everything else the service caches, so asking
    /// twice reuses what is already there.
    #[must_use]
    pub fn id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(self.input_path.as_bytes());
        hasher.update(self.duration_seconds.to_be_bytes());
        hasher.update(self.width.to_be_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            id.push_str(&format!("{byte:02x}"));
        }

        id
    }

    /// Where in the file this clip starts.
    #[must_use]
    pub fn start_seconds(&self, duration_seconds: f64) -> u32 {
        #[expect(
            clippy::cast_possible_truncation,
            clippy::cast_sign_loss,
            reason = "a position inside a running time is far below the limits of the cast"
        )]
        self.at_seconds
            .unwrap_or_else(|| (duration_seconds * DEFAULT_POSITION) as u32)
    }
}

/// Where a preview lives.
#[must_use]
pub fn directory_for(cache_root: &Path, id: &str) -> PathBuf {
    cache_root.join("previews").join(id)
}

/// Whether a preview has already been made.
pub async fn is_complete(cache_root: &Path, id: &str) -> bool {
    tokio::fs::try_exists(directory_for(cache_root, id).join(COMPLETE_MARKER))
        .await
        .unwrap_or(false)
}

/// The ffmpeg arguments that cut and encode the clip.
///
/// Encoded rather than copied, and to something every browser plays without
/// help: the point of a preview is that it needs nothing running behind it, so
/// it has to be a file a video element can open on its own. The seek comes
/// before the input, which makes taking a clip from the middle of a long film
/// a matter of a second rather than of minutes.
#[must_use]
pub fn preview_arguments(
    request: &PreviewRequest,
    start_seconds: u32,
    range: VideoRange,
    tone_mapping: ToneMapping,
    output: &Path,
) -> Vec<String> {
    let mut filters = Vec::new();

    // An HDR source encoded straight to a browser clip looks washed out, in
    // exactly the way a stream would. The same conversion applies.
    if range != VideoRange::Sdr {
        if let Some(filter) = tone_map_filter(tone_mapping) {
            filters.push(filter.to_owned());
        }
    }

    // Never scaled up: a film shot at 720 gains nothing from being stretched
    // to a preview twice its size, and the encoder would spend the effort.
    filters.push(format!("scale='min({width},iw)':-2", width = request.width));

    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-ss".to_owned(),
        start_seconds.to_string(),
        "-i".to_owned(),
        request.input_path.clone(),
        "-t".to_owned(),
        request.duration_seconds.to_string(),
        "-vf".to_owned(),
        filters.join(","),
        "-c:v".to_owned(),
        "libx264".to_owned(),
        "-preset".to_owned(),
        "veryfast".to_owned(),
        "-crf".to_owned(),
        QUALITY.to_owned(),
        "-profile:v".to_owned(),
        "high".to_owned(),
        "-pix_fmt".to_owned(),
        "yuv420p".to_owned(),
        "-c:a".to_owned(),
        "aac".to_owned(),
        "-b:a".to_owned(),
        "128k".to_owned(),
        "-ac".to_owned(),
        "2".to_owned(),
        // The index goes at the front, so a browser can start playing without
        // fetching the whole file first.
        "-movflags".to_owned(),
        "+faststart".to_owned(),
        "-y".to_owned(),
        output.to_string_lossy().into_owned(),
    ]
}

/// Makes the clip, or reuses the one already there.
///
/// # Errors
///
/// Returns [`PreviewError`] when the directory cannot be made, ffmpeg cannot
/// be started, or it writes nothing.
pub async fn generate(
    ffmpeg: &str,
    cache_root: &Path,
    request: &PreviewRequest,
    range: VideoRange,
    tone_mapping: ToneMapping,
    duration_seconds: f64,
) -> Result<PreviewClip, PreviewError> {
    let id = request.id();
    let directory = directory_for(cache_root, &id);
    let output = directory.join(PREVIEW_NAME);

    let finish = |is_ready: bool| PreviewClip {
        url: format!("/previews/{id}/{PREVIEW_NAME}"),
        id: id.clone(),
        is_ready,
    };

    if is_complete(cache_root, &id).await {
        return Ok(finish(true));
    }

    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(PreviewError::Directory)?;

    let outcome = Command::new(ffmpeg)
        .args(preview_arguments(
            request,
            request.start_seconds(duration_seconds),
            range,
            tone_mapping,
            &output,
        ))
        .output()
        .await
        .map_err(PreviewError::Spawn)?;

    let written = tokio::fs::metadata(&output)
        .await
        .map(|file| file.len())
        .unwrap_or(0);

    if !outcome.status.success() || written == 0 {
        return Err(PreviewError::NoOutput(
            String::from_utf8_lossy(&outcome.stderr).trim().to_owned(),
        ));
    }

    tokio::fs::write(directory.join(COMPLETE_MARKER), b"")
        .await
        .map_err(PreviewError::Marker)?;

    Ok(finish(true))
}

#[cfg(test)]
mod tests {
    use super::{preview_arguments, PreviewRequest};
    use crate::media::VideoRange;
    use crate::transcode_plan::ToneMapping;
    use std::path::Path;

    fn request() -> PreviewRequest {
        PreviewRequest {
            input_path: "/media/film.mkv".to_owned(),
            at_seconds: None,
            duration_seconds: 24,
            width: 1920,
            wait: false,
        }
    }

    #[test]
    fn seeks_before_opening_the_file() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            Path::new("/cache/preview.mp4"),
        );

        let seek = arguments.iter().position(|argument| argument == "-ss");
        let input = arguments.iter().position(|argument| argument == "-i");

        assert!(seek < input, "input seeking is what makes this quick");
    }

    #[test]
    fn tone_maps_an_hdr_source() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Hdr10,
            ToneMapping::Zscale,
            Path::new("/cache/preview.mp4"),
        );

        let filters = arguments
            .iter()
            .position(|argument| argument == "-vf")
            .map(|at| arguments[at + 1].clone())
            .expect("filters");

        assert!(
            filters.contains("tonemap"),
            "an HDR preview must not be washed out"
        );
    }

    #[test]
    fn leaves_an_sdr_source_alone() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            Path::new("/cache/preview.mp4"),
        );

        let filters = arguments
            .iter()
            .position(|argument| argument == "-vf")
            .map(|at| arguments[at + 1].clone())
            .expect("filters");

        assert!(!filters.contains("tonemap"));
        assert!(filters.contains("scale='min(1920,iw)':-2"));
    }

    #[test]
    fn starts_a_fifth_of_the_way_in_by_default() {
        assert_eq!(request().start_seconds(1000.0), 200);
    }

    #[test]
    fn is_named_the_same_for_the_same_clip() {
        assert_eq!(request().id(), request().id());
    }
}
