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

use crate::capability::Capabilities;
use crate::integrity::decodes;
use crate::media::VideoRange;
use crate::transcode_plan::{tone_map_filter, HardwareAccel, ToneMapping, NO_EMBEDDED_CAPTIONS};

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

/// What a hardware encoder is asked for instead of a quality target.
///
/// x264 is told a quality and finds the bitrate. Hardware encoders mostly have
/// no equivalent, so they are told a bitrate and find the quality. This is what
/// `QUALITY` produces on 1080p material, so the two routes come out at roughly
/// the same size.
const HARDWARE_BITRATE_KBPS: u32 = 6000;

/// How a preview's video gets encoded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PreviewEncoder {
    /// x264, at a quality target.
    Software,
    /// The machine's own encoder, at a bitrate target.
    Hardware(String),
}

/// Picks the encoder a preview should use.
///
/// A preview is a full length encode of a 24 second window, made once per file
/// in the library. Doing that in software costs around fifteen times the
/// processor time of doing it on the encoder already sitting in the machine,
/// and a scan runs several at once.
#[must_use]
pub fn preview_encoder(capabilities: &Capabilities) -> PreviewEncoder {
    match capabilities.best_encoder("h264") {
        Some(found) if found.accel != HardwareAccel::None => {
            PreviewEncoder::Hardware(found.encoder.clone())
        }
        _ => PreviewEncoder::Software,
    }
}

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
    /// Which audio stream the clip should carry, when a library forces one.
    ///
    /// Absent leaves the choice to ffmpeg, exactly as before this existed.
    #[serde(default)]
    pub audio_stream_index: Option<u32>,
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
    #[error("the clip ffmpeg produced does not decode: {0}")]
    Corrupt(String),
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
        hasher.update(self.audio_stream_index.unwrap_or(u32::MAX).to_be_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            use std::fmt::Write;

            let _ = write!(id, "{byte:02x}");
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
            .unwrap_or((duration_seconds * DEFAULT_POSITION) as u32)
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
///
/// Decoding is handed to the hardware whenever the encoding is, which is the
/// larger half of the saving: the frames still come back to system memory for
/// the scale, but decoding a 10-bit source in software costs several times
/// what the transfer does.
#[must_use]
pub fn preview_arguments(
    request: &PreviewRequest,
    start_seconds: u32,
    range: VideoRange,
    tone_mapping: ToneMapping,
    encoder: &PreviewEncoder,
    accel: Option<&str>,
    output: &Path,
) -> Vec<String> {
    let mut filters = Vec::new();

    if range != VideoRange::Sdr {
        if let Some(filter) = tone_map_filter(tone_mapping) {
            filters.push(filter.to_owned());
        }
    }

    filters.push(format!("scale='min({width},iw)':-2", width = request.width));

    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
    ];

    if let Some(flag) = accel {
        arguments.push("-hwaccel".to_owned());
        arguments.push(flag.to_owned());
    }

    arguments.extend([
        "-ss".to_owned(),
        start_seconds.to_string(),
        "-i".to_owned(),
        request.input_path.clone(),
        "-t".to_owned(),
        request.duration_seconds.to_string(),
    ]);

    if let Some(index) = request.audio_stream_index {
        arguments.push("-map".to_owned());
        arguments.push("0:v:0".to_owned());
        arguments.push("-map".to_owned());
        arguments.push(format!("0:{index}"));
    }

    arguments.extend(["-vf".to_owned(), filters.join(",")]);

    match encoder {
        PreviewEncoder::Software => arguments.extend([
            "-c:v".to_owned(),
            "libx264".to_owned(),
            "-preset".to_owned(),
            "veryfast".to_owned(),
            "-crf".to_owned(),
            QUALITY.to_owned(),
        ]),
        PreviewEncoder::Hardware(name) => arguments.extend([
            "-c:v".to_owned(),
            name.clone(),
            "-b:v".to_owned(),
            format!("{HARDWARE_BITRATE_KBPS}k"),
        ]),
    }

    arguments.extend([
        "-profile:v".to_owned(),
        "high".to_owned(),
        "-pix_fmt".to_owned(),
        "yuv420p".to_owned(),
        NO_EMBEDDED_CAPTIONS[0].to_owned(),
        NO_EMBEDDED_CAPTIONS[1].to_owned(),
        "-c:a".to_owned(),
        "aac".to_owned(),
        "-b:a".to_owned(),
        "128k".to_owned(),
        "-ac".to_owned(),
        "2".to_owned(),
        "-movflags".to_owned(),
        "+faststart".to_owned(),
        "-y".to_owned(),
        output.to_string_lossy().into_owned(),
    ]);

    arguments
}

/// Makes the clip, or reuses the one already there.
///
/// The clip is decoded before it is marked complete. An encoder that exits zero
/// and writes a full-sized file can still have produced something that plays as
/// black, and a preview is cached for as long as the library stands, so the
/// check is what stops one bad encode becoming permanent. A clip that fails it
/// is treated exactly like an encoder that refused to start, which means the
/// software fallback below already handles it.
///
/// # Errors
///
/// Returns [`PreviewError`] when the directory cannot be made, ffmpeg cannot be
/// started, it writes nothing, or what it wrote will not decode even in
/// software.
pub async fn generate(
    ffmpeg: &str,
    cache_root: &Path,
    request: &PreviewRequest,
    range: VideoRange,
    capabilities: &Capabilities,
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

    let tone_mapping = capabilities.tone_mapping;
    let start = request.start_seconds(duration_seconds);
    let mut chosen = preview_encoder(capabilities);

    loop {
        let accel = match &chosen {
            PreviewEncoder::Hardware(_) => capabilities
                .best_encoder("h264")
                .and_then(|found| found.accel.ffmpeg_flag()),
            PreviewEncoder::Software => None,
        };

        let outcome = Command::new(ffmpeg)
            .args(preview_arguments(
                request,
                start,
                range,
                tone_mapping,
                &chosen,
                accel,
                &output,
            ))
            .output()
            .await
            .map_err(PreviewError::Spawn)?;

        let written = tokio::fs::metadata(&output)
            .await
            .map_or(0, |file| file.len());

        let failure = if outcome.status.success() && written > 0 {
            decodes(ffmpeg, &output)
                .await
                .err()
                .map(PreviewError::Corrupt)
        } else {
            Some(PreviewError::NoOutput(
                String::from_utf8_lossy(&outcome.stderr).trim().to_owned(),
            ))
        };

        let Some(failure) = failure else {
            break;
        };

        if chosen == PreviewEncoder::Software {
            return Err(failure);
        }

        eprintln!(
            "preview: hardware encode of {} failed, retrying in software: {failure}",
            request.input_path
        );

        chosen = PreviewEncoder::Software;
    }

    tokio::fs::write(directory.join(COMPLETE_MARKER), b"")
        .await
        .map_err(PreviewError::Marker)?;

    Ok(finish(true))
}

#[cfg(test)]
mod tests {
    use super::{preview_arguments, preview_encoder, PreviewEncoder, PreviewRequest};
    use crate::capability::{Capabilities, VerifiedEncoder};
    use crate::media::VideoRange;
    use crate::transcode_plan::HardwareAccel;
    use crate::transcode_plan::ToneMapping;
    use std::path::Path;

    fn request() -> PreviewRequest {
        PreviewRequest {
            input_path: "/media/film.mkv".to_owned(),
            at_seconds: None,
            duration_seconds: 24,
            width: 1920,
            wait: false,
            audio_stream_index: None,
        }
    }

    fn capabilities_with(encoder: &str, accel: HardwareAccel) -> Capabilities {
        Capabilities {
            ffmpeg_version: "8.1.2".to_owned(),
            encoders: vec![VerifiedEncoder {
                codec: "h264".to_owned(),
                encoder: encoder.to_owned(),
                accel,
                verified: true,
            }],
            hardware_accels: vec![accel],
            tone_mapping: ToneMapping::Zscale,
            rejected: Vec::new(),
            hardware_scalers: Vec::new(),
            can_burn_text_subtitles: true,
            can_burn_image_subtitles: true,
        }
    }

    #[test]
    fn takes_the_machines_encoder_when_it_has_one() {
        let chosen = preview_encoder(&capabilities_with(
            "h264_videotoolbox",
            HardwareAccel::VideoToolbox,
        ));

        assert_eq!(
            chosen,
            PreviewEncoder::Hardware("h264_videotoolbox".to_owned())
        );
    }

    #[test]
    fn falls_back_to_x264_on_a_machine_with_no_encoder() {
        let chosen = preview_encoder(&capabilities_with("libx264", HardwareAccel::None));

        assert_eq!(chosen, PreviewEncoder::Software);
    }

    #[test]
    fn asks_a_hardware_encoder_for_a_bitrate_rather_than_a_quality() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_videotoolbox".to_owned()),
            Some("videotoolbox"),
            Path::new("/cache/preview.mp4"),
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "h264_videotoolbox"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-b:v", "6000k"]));
        assert!(!arguments.iter().any(|argument| argument == "-crf"));
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-hwaccel", "videotoolbox"]));
    }

    #[test]
    fn keeps_x264_on_a_quality_target() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            &PreviewEncoder::Software,
            None,
            Path::new("/cache/preview.mp4"),
        );

        assert!(arguments.windows(2).any(|pair| pair == ["-c:v", "libx264"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-crf", "20"]));
        assert!(!arguments.iter().any(|argument| argument == "-b:v"));
        assert!(!arguments.iter().any(|argument| argument == "-hwaccel"));
    }

    #[test]
    fn stays_playable_by_a_bare_video_element_on_either_route() {
        for encoder in [
            PreviewEncoder::Software,
            PreviewEncoder::Hardware("h264_videotoolbox".to_owned()),
        ] {
            let arguments = preview_arguments(
                &request(),
                600,
                VideoRange::Sdr,
                ToneMapping::Zscale,
                &encoder,
                None,
                Path::new("/cache/preview.mp4"),
            );

            assert!(arguments
                .windows(2)
                .any(|pair| pair == ["-profile:v", "high"]));
            assert!(arguments
                .windows(2)
                .any(|pair| pair == ["-pix_fmt", "yuv420p"]));
            assert!(arguments
                .windows(2)
                .any(|pair| pair == ["-movflags", "+faststart"]));
        }
    }

    #[test]
    fn seeks_before_opening_the_file() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            &PreviewEncoder::Software,
            None,
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
            &PreviewEncoder::Software,
            None,
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
            &PreviewEncoder::Software,
            None,
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

    #[test]
    fn leaves_stream_selection_to_ffmpeg_when_no_language_is_forced() {
        let arguments = preview_arguments(
            &request(),
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            &PreviewEncoder::Software,
            None,
            Path::new("/cache/preview.mp4"),
        );

        assert!(!arguments.iter().any(|argument| argument == "-map"));
    }

    #[test]
    fn maps_the_forced_audio_stream_explicitly() {
        let forced = PreviewRequest {
            audio_stream_index: Some(2),
            ..request()
        };

        let arguments = preview_arguments(
            &forced,
            600,
            VideoRange::Sdr,
            ToneMapping::Zscale,
            &PreviewEncoder::Software,
            None,
            Path::new("/cache/preview.mp4"),
        );

        assert!(arguments.windows(2).any(|pair| pair == ["-map", "0:v:0"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-map", "0:2"]));
    }

    #[test]
    fn identifies_clips_for_different_forced_languages_separately() {
        let english = PreviewRequest {
            audio_stream_index: Some(2),
            ..request()
        };
        let german = PreviewRequest {
            audio_stream_index: Some(1),
            ..request()
        };

        assert_ne!(english.id(), german.id());
        assert_ne!(english.id(), request().id());
    }
}
