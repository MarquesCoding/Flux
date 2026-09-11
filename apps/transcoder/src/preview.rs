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

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::capability::Capabilities;
use crate::chains::{runs_here, ChainShape};
use crate::integrity::decodes;
use crate::media::VideoRange;
use crate::monitor::{record, LogLevel};
use crate::transcode_plan::{tone_map_filter, HardwareAccel, ToneMapping, NO_EMBEDDED_CAPTIONS};

/// The file a preview is written to.
pub const PREVIEW_NAME: &str = "preview.mp4";

/// Written only when the clip is whole.
const COMPLETE_MARKER: &str = ".complete";

/// Which recipe made a clip.
///
/// A preview is addressed by its content, and until this existed the address
/// covered the file and the geometry but not *how* the clip was made. So moving
/// previews onto a hardware encoder, or changing the bitrate or the filter
/// chain, left every existing clip in place and served it for ever: correct by
/// the address, stale in fact.
///
/// **Raise this whenever the way a clip is made changes.** Doing so gives every
/// clip a new address, so the next scan renders it again and the old file is
/// simply never read. Previews and sheets carry their own numbers, because
/// changing how a clip is encoded is no reason to spend minutes a film redrawing
/// thumbnails.
const RECIPE: u32 = 1;

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
///
/// A backend chosen by hand is honoured here, which it was not before: the
/// setting reached transcodes and nothing else, so an operator who had chosen
/// VAAPI still had every preview drawn on QSV.
#[must_use]
pub fn preview_encoder(
    capabilities: &Capabilities,
    chosen: Option<HardwareAccel>,
) -> PreviewEncoder {
    match capabilities.encoder_for("h264", chosen) {
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
    /// How many times the library holding this file has been reset.
    ///
    /// Part of the clip's address, so a reset renames every clip and the next
    /// scan makes them again. Deliberately **not** defaulted: a caller that
    /// forgets it would otherwise ask for generation zero, miss the cache for
    /// ever, and re-encode a clip on every request. A missing field failing the
    /// request outright is the cheaper mistake by a long way.
    pub generation: u32,
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
    /// The backend the operator chose, where they chose one.
    ///
    /// Absent means automatic, which is what a caller written before this
    /// existed asks for and what it used to get regardless.
    #[serde(default)]
    pub hardware_accel: Option<HardwareAccel>,
    /// Which of the server's jobs asked for this, where one did.
    ///
    /// Carried only so the queue can say which scan a piece of work belongs
    /// to. A player asking for its own thumbnails is nobody's, so this is
    /// absent rather than empty.
    #[serde(default)]
    pub owner: Option<String>,
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
    /// twice reuses what is already there — and [`RECIPE`] is part of the
    /// address, so asking twice across a change to how clips are made does not.
    #[must_use]
    pub fn id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(RECIPE.to_be_bytes());
        hasher.update(self.generation.to_be_bytes());
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

/// Where ffmpeg is, and the device it may render on.
#[derive(Clone, Copy)]
pub struct Tools<'a> {
    /// The ffmpeg binary to run.
    pub ffmpeg: &'a str,
    /// The render node to open, where this machine has one.
    pub device: &'a str,
}

/// A backend to decode on, and the device to open for it.
pub type OnDevice<'a> = Option<(HardwareAccel, &'a str)>;

/// What the source picture is, as far as the filters need to know.
#[derive(Clone, Copy)]
pub struct Source {
    /// Whether it needs converting to something a browser draws.
    pub range: VideoRange,
    /// What its frames come down as, which a ten-bit film answers differently.
    pub bit_depth: Option<u8>,
}

/// The ffmpeg arguments that cut and encode the clip.
///
/// Encoded rather than copied, and to something every browser plays without
/// help: the point of a preview is that it needs nothing running behind it, so
/// it has to be a file a video element can open on its own. The seek comes
/// before the input, which makes taking a clip from the middle of a long film
/// a matter of a second rather than of minutes.
///
/// Decoded on the device, brought down for the filters, and sent back up to be
/// encoded.
///
/// Every filter here works in system memory — the scale always, the tone mapper
/// when the source is HDR — so the frames have to come down, and `hwdownload`
/// is named rather than left to ffmpeg: `-hwaccel` alone leaves some backends
/// handing device frames straight into a software filter, and QSV is one of
/// them.
///
/// They have to go back up again just as explicitly. A hardware encoder fed
/// from a device that is already open wants that device's surfaces, and handing
/// it system memory instead is refused at the first frame — "Invalid
/// FrameType:0", then "Error submitting video frame to the encoder". A bare
/// `hwupload` is enough here because the download earlier in the same chain
/// leaves a frames context in hand.
///
/// Decoding is still worth doing on the device. It is the expensive half, and a
/// 10-bit source costs several times in software what the two transfers do.
///
/// A chain that ends on the device is not told a pixel format. `-pix_fmt
/// yuv420p` names a format that lives in system memory, so ffmpeg answers it by
/// putting a software scaler between `hwupload` and the encoder and then cannot
/// configure it — "Impossible to convert between the formats supported by the
/// filter `Parsed_hwupload_3`". The frames are already the format the encoder
/// wants; saying so again in system-memory terms is what breaks it.
///
/// A ten-bit film is narrowed before it reaches the encoder. A preview is an
/// H.264 clip whatever it was made from, and no Intel part encodes ten-bit
/// H.264 — High 10 is not in the silicon, on `QSV` or on `VAAPI`. Handed the
/// `p010` frames the download had to produce, `h264_qsv` writes nothing and
/// reports only that nothing was written, which is what every 2160p film on a
/// verified machine did.
#[must_use]
pub fn preview_arguments(
    request: &PreviewRequest,
    start_seconds: u32,
    source: Source,
    tone_mapping: ToneMapping,
    encoder: &PreviewEncoder,
    on_device: OnDevice<'_>,
    output: &Path,
) -> Vec<String> {
    let mut filters = Vec::new();
    let onto_the_device = on_device
        .and_then(|(found, device)| found.pipeline().map(|pipeline| (found, pipeline, device)));

    if let Some((_, pipeline, _)) = onto_the_device {
        filters.push(format!(
            "hwdownload,format={}",
            pipeline.download_format_for(source.bit_depth)
        ));
    }

    if source.range != VideoRange::Sdr {
        if let Some(filter) = tone_map_filter(tone_mapping) {
            filters.push(filter.to_owned());
        }
    }

    filters.push(format!("scale='min({width},iw)':-2", width = request.width));

    if source.bit_depth.is_some_and(|depth| depth > 8) {
        filters.push("format=nv12".to_owned());
    }

    let encodes_from_device =
        onto_the_device.is_some_and(|(_, pipeline, _)| pipeline.encodes_from_device);

    if let Some((_, pipeline, _)) = onto_the_device.filter(|_| encodes_from_device) {
        filters.push(pipeline.upload.to_owned());
    }

    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
    ];

    if let Some((found, pipeline, device)) = onto_the_device {
        arguments.extend(found.filter_device_arguments(device));

        if let Some(flag) = found.ffmpeg_flag() {
            arguments.push("-hwaccel".to_owned());
            arguments.push(flag.to_owned());
            arguments.push("-hwaccel_output_format".to_owned());
            arguments.push(pipeline.output_format.to_owned());
        }
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

    arguments.extend(["-profile:v".to_owned(), "high".to_owned()]);

    if !encodes_from_device {
        arguments.extend(["-pix_fmt".to_owned(), "yuv420p".to_owned()]);
    }

    arguments.extend([
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
    tools: Tools<'_>,
    cache_root: &Path,
    request: &PreviewRequest,
    source: Source,
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
    let mut chosen = preview_encoder(capabilities, request.hardware_accel);

    loop {
        let accel = match &chosen {
            PreviewEncoder::Hardware(_) => capabilities
                .encoder_for("h264", request.hardware_accel)
                .map(|found| found.accel)
                .filter(|found| {
                    runs_here(
                        &capabilities.chains,
                        *found,
                        ChainShape::Preview,
                        source.bit_depth,
                    )
                }),
            PreviewEncoder::Software => None,
        };

        let outcome = Command::new(tools.ffmpeg)
            .args(preview_arguments(
                request,
                start,
                source,
                tone_mapping,
                &chosen,
                accel.map(|found| (found, tools.device)),
                &output,
            ))
            .output()
            .await
            .map_err(PreviewError::Spawn)?;

        let written = tokio::fs::metadata(&output)
            .await
            .map_or(0, |file| file.len());

        let failure = if outcome.status.success() && written > 0 {
            decodes(tools.ffmpeg, &output)
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

        record(
            LogLevel::Warn,
            "preview",
            &format!(
                "hardware encode of {} failed, retrying in software: {failure}",
                request.input_path
            ),
        );

        chosen = PreviewEncoder::Software;
    }

    tokio::fs::write(directory.join(COMPLETE_MARKER), b"")
        .await
        .map_err(PreviewError::Marker)?;

    Ok(finish(true))
}

/// Serialises requests for the same clip.
///
/// Every caller that asks while a render is running would otherwise start its
/// own ffmpeg writing the same `preview.mp4`, and `-y` truncates it on the way
/// in. The completion marker cannot prevent it: none of them find one, because
/// none of them have finished.
///
/// Measured before this existed. Six requests for one clip arrived in two
/// waves, four ran at once, and the file they shared decoded as garbage —
/// `Invalid NAL unit size (1107016360 > 45258)`. Every verification then failed,
/// nothing was marked complete, so the item stayed outstanding and was rendered
/// again, concurrently, into the same file. It could not converge.
///
/// Worse than it first looks: a job whose hardware encode fails retries in
/// software to that same path, so four callers are up to eight writers.
#[derive(Clone, Default)]
pub struct PreviewRegistry {
    in_flight: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
}

impl PreviewRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    async fn gate(&self, id: &str) -> Arc<Mutex<()>> {
        let mut in_flight = self.in_flight.lock().await;

        Arc::clone(in_flight.entry(id.to_owned()).or_default())
    }

    async fn release(&self, id: &str) {
        let mut in_flight = self.in_flight.lock().await;

        if in_flight
            .get(id)
            .is_some_and(|gate| Arc::strong_count(gate) <= 2)
        {
            in_flight.remove(id);
        }
    }

    /// Renders the clip, or reuses what is already there.
    ///
    /// Waits rather than duplicating the work when the same clip is already
    /// being rendered. The second caller through finds the finished marker and
    /// returns it without starting anything.
    ///
    /// # Errors
    ///
    /// Returns [`PreviewError`] for the same reasons [`generate`] does.
    pub async fn generate(
        &self,
        tools: Tools<'_>,
        cache_root: &Path,
        request: &PreviewRequest,
        source: Source,
        capabilities: &Capabilities,
        duration_seconds: f64,
    ) -> Result<PreviewClip, PreviewError> {
        let id = request.id();
        let gate = self.gate(&id).await;
        let permit = gate.lock().await;

        let outcome = generate(
            tools,
            cache_root,
            request,
            source,
            capabilities,
            duration_seconds,
        )
        .await;

        drop(permit);
        self.release(&id).await;

        outcome
    }
}

#[cfg(test)]
mod tests {
    use super::{preview_arguments, preview_encoder, PreviewEncoder, PreviewRequest, Source};
    use crate::capability::{Capabilities, VerifiedEncoder};
    use crate::media::VideoRange;
    use crate::transcode_plan::HardwareAccel;
    use crate::transcode_plan::ToneMapping;
    use std::path::Path;

    fn request() -> PreviewRequest {
        PreviewRequest {
            input_path: "/media/film.mkv".to_owned(),
            generation: 0,
            at_seconds: None,
            duration_seconds: 24,
            width: 1920,
            hardware_accel: None,
            wait: false,
            audio_stream_index: None,
            owner: None,
        }
    }

    fn capabilities_with(encoder: &str, accel: HardwareAccel) -> Capabilities {
        Capabilities {
            ffmpeg_version: "8.1.2".to_owned(),
            probe_version: crate::probe::PROBE_VERSION,
            ffmpeg_supported: true,
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
            hardware_overlays: Vec::new(),
            hardware_tone_maps: Vec::new(),
            can_burn_text_subtitles: true,
            can_burn_image_subtitles: true,
            chains: Vec::new(),
        }
    }

    #[test]
    fn takes_the_machines_encoder_when_it_has_one() {
        let chosen = preview_encoder(
            &capabilities_with("h264_videotoolbox", HardwareAccel::VideoToolbox),
            None,
        );

        assert_eq!(
            chosen,
            PreviewEncoder::Hardware("h264_videotoolbox".to_owned())
        );
    }

    #[test]
    fn falls_back_to_x264_on_a_machine_with_no_encoder() {
        let chosen = preview_encoder(&capabilities_with("libx264", HardwareAccel::None), None);

        assert_eq!(chosen, PreviewEncoder::Software);
    }

    /// The setting reached transcodes and nothing else, so a machine set to
    /// VAAPI drew every preview on QSV without saying so.
    #[test]
    fn draws_on_the_backend_the_operator_chose_rather_than_the_first_listed() {
        let capabilities = Capabilities {
            encoders: vec![
                VerifiedEncoder {
                    codec: "h264".to_owned(),
                    encoder: "h264_qsv".to_owned(),
                    accel: HardwareAccel::Qsv,
                    verified: true,
                },
                VerifiedEncoder {
                    codec: "h264".to_owned(),
                    encoder: "h264_vaapi".to_owned(),
                    accel: HardwareAccel::Vaapi,
                    verified: true,
                },
            ],
            ..capabilities_with("h264_qsv", HardwareAccel::Qsv)
        };

        assert_eq!(
            preview_encoder(&capabilities, Some(HardwareAccel::Vaapi)),
            PreviewEncoder::Hardware("h264_vaapi".to_owned())
        );
        assert_eq!(
            preview_encoder(&capabilities, None),
            PreviewEncoder::Hardware("h264_qsv".to_owned())
        );
    }

    /// A choice this machine cannot honour draws on what is here instead.
    #[test]
    fn falls_back_where_the_chosen_backend_is_not_on_this_machine() {
        let chosen = preview_encoder(
            &capabilities_with("h264_qsv", HardwareAccel::Qsv),
            Some(HardwareAccel::Nvenc),
        );

        assert_eq!(chosen, PreviewEncoder::Hardware("h264_qsv".to_owned()));
    }

    #[test]
    fn asks_a_hardware_encoder_for_a_bitrate_rather_than_a_quality() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_videotoolbox".to_owned()),
            Some((HardwareAccel::VideoToolbox, "/dev/dri/renderD128")),
            Path::new("/cache/preview.mp4"),
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "h264_videotoolbox"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-b:v", "6000k"]));
        assert!(!arguments.iter().any(|argument| argument == "-crf"));
    }

    /// The frames come down where the filters are, and are told what to come
    /// down as. Left to ffmpeg the graph does not configure at all on QSV.
    #[test]
    fn decodes_on_the_device_and_brings_the_frames_down() {
        for range in [VideoRange::Sdr, VideoRange::Hdr10] {
            let arguments = preview_arguments(
                &request(),
                600,
                Source {
                    range,
                    bit_depth: Some(8),
                },
                ToneMapping::Zscale,
                &PreviewEncoder::Hardware("h264_qsv".to_owned()),
                Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
                Path::new("/cache/preview.mp4"),
            );

            let chain = arguments
                .windows(2)
                .find(|pair| pair[0] == "-vf")
                .map(|pair| pair[1].clone())
                .expect("a filter chain");

            assert!(
                arguments.windows(2).any(|pair| pair == ["-hwaccel", "qsv"]),
                "{range:?}: {arguments:?}"
            );
            assert!(
                arguments
                    .windows(2)
                    .any(|pair| pair == ["-hwaccel_output_format", "qsv"]),
                "{range:?}: {arguments:?}"
            );
            assert!(
                chain.starts_with("hwdownload,format=nv12,"),
                "{range:?}: {chain}"
            );
        }
    }

    /// No Intel part encodes ten-bit H.264, so the frames narrow on their way.
    #[test]
    fn narrows_a_ten_bit_film_before_it_reaches_the_encoder() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(10),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_qsv".to_owned()),
            Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
            Path::new("/cache/preview.mp4"),
        );

        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(chain.starts_with("hwdownload,format=p010le,"), "{chain}");
        assert!(
            chain.ends_with(",format=nv12,hwupload=extra_hw_frames=64"),
            "{chain}"
        );
    }

    #[test]
    fn leaves_an_eight_bit_film_as_it_found_it() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_qsv".to_owned()),
            Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
            Path::new("/cache/preview.mp4"),
        );

        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert!(!chain.contains("format=nv12,hwupload"), "{chain}");
        assert!(chain.ends_with(",hwupload=extra_hw_frames=64"), "{chain}");
    }

    #[test]
    fn encodes_in_software_without_asking_the_device_for_anything() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Software,
            None,
            Path::new("/cache/preview.mp4"),
        );

        assert!(!arguments.iter().any(|argument| argument == "-hwaccel"));
        assert!(!arguments
            .iter()
            .any(|argument| argument.contains("hwdownload")));
    }

    #[test]
    fn keeps_x264_on_a_quality_target() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
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
                Source {
                    range: VideoRange::Sdr,
                    bit_depth: Some(8),
                },
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

    /// Naming a system-memory format is what puts a scaler after the upload.
    #[test]
    fn does_not_name_a_pixel_format_for_a_chain_that_ends_on_the_device() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_qsv".to_owned()),
            Some((HardwareAccel::Qsv, "/dev/dri/renderD128")),
            Path::new("/cache/preview.mp4"),
        );

        assert!(!arguments.iter().any(|argument| argument == "-pix_fmt"));
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-profile:v", "high"]));
    }

    /// `VideoToolbox` takes system memory, so the format still has to be named.
    #[test]
    fn names_a_pixel_format_where_the_encoder_reads_system_memory() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
            ToneMapping::Zscale,
            &PreviewEncoder::Hardware("h264_videotoolbox".to_owned()),
            Some((HardwareAccel::VideoToolbox, "/dev/dri/renderD128")),
            Path::new("/cache/preview.mp4"),
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-pix_fmt", "yuv420p"]));
    }

    #[test]
    fn seeks_before_opening_the_file() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
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
            Source {
                range: VideoRange::Hdr10,
                bit_depth: Some(8),
            },
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
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
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
    fn a_reset_library_addresses_its_clips_somewhere_new() {
        let after_reset = PreviewRequest {
            generation: 1,
            ..request()
        };

        assert_ne!(
            request().id(),
            after_reset.id(),
            "a reset that reused the address would reuse the clip"
        );
    }

    #[test]
    fn the_same_generation_still_reuses_the_clip() {
        let again = PreviewRequest {
            generation: 3,
            ..request()
        };
        let and_again = PreviewRequest {
            generation: 3,
            ..request()
        };

        assert_eq!(
            again.id(),
            and_again.id(),
            "an ordinary scan must not re-encode what it already has"
        );
    }

    #[test]
    fn the_recipe_is_part_of_the_address() {
        use sha2::{Digest as _, Sha256};
        use std::fmt::Write as _;

        let request = request();
        let mut hasher = Sha256::new();

        hasher.update(request.input_path.as_bytes());
        hasher.update(request.duration_seconds.to_be_bytes());
        hasher.update(request.width.to_be_bytes());
        hasher.update(request.audio_stream_index.unwrap_or(u32::MAX).to_be_bytes());

        let mut without_the_recipe = String::with_capacity(32);

        for byte in hasher.finalize().iter().take(16) {
            let _ = write!(without_the_recipe, "{byte:02x}");
        }

        assert_ne!(
            request.id(),
            without_the_recipe,
            "a clip made by an older recipe must not answer to the same address"
        );
    }

    #[test]
    fn leaves_stream_selection_to_ffmpeg_when_no_language_is_forced() {
        let arguments = preview_arguments(
            &request(),
            600,
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
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
            Source {
                range: VideoRange::Sdr,
                bit_depth: Some(8),
            },
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
