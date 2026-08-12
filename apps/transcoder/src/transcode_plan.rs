use std::fmt::Write as _;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// A hardware acceleration backend the host may offer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HardwareAccel {
    None,
    Vaapi,
    Qsv,
    Nvenc,
    Amf,
    VideoToolbox,
    Rkmpp,
}

impl HardwareAccel {
    /// The `-hwaccel` value `FFmpeg` expects, if any.
    #[must_use]
    pub fn ffmpeg_flag(self) -> Option<&'static str> {
        match self {
            Self::None => None,
            Self::Vaapi => Some("vaapi"),
            Self::Qsv => Some("qsv"),
            Self::Nvenc => Some("cuda"),
            Self::Amf => Some("d3d11va"),
            Self::VideoToolbox => Some("videotoolbox"),
            Self::Rkmpp => Some("rkmpp"),
        }
    }
}

/// How HDR is converted to SDR.
///
/// Tone mapping needs a filter that can linearise a PQ or HLG transfer curve.
/// `tonemap` alone cannot: it expects linear light, and feeding it PQ-encoded
/// samples produces a washed out picture that looks broken rather than
/// obviously wrong. See ADR-0010.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToneMapping {
    /// `zscale` plus `tonemap`. The usual route, needs libzimg.
    Zscale,
    /// `libplacebo`, which does the whole conversion in one filter.
    Libplacebo,
    /// This build cannot tone map. Colours will be wrong, so callers must say
    /// so rather than pretending the conversion happened.
    Unavailable,
}

/// What should happen to the video stream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum VideoAction {
    Copy,
    Encode {
        encoder: String,
        max_bitrate_kbps: u32,
        max_width: u32,
        max_height: u32,
        #[serde(default)]
        tone_map: Option<ToneMapping>,
    },
}

/// What should happen to the audio stream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AudioAction {
    Copy,
    Encode {
        encoder: String,
        channels: u8,
        max_bitrate_kbps: u32,
    },
}

/// How a subtitle stream is delivered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SubtitleAction {
    /// Nothing to do: no subtitles, or the client renders them itself.
    None,
    /// Draw the subtitles onto the frames.
    ///
    /// Required when the client cannot render the format, and unavoidable for
    /// bitmap formats, which cannot be converted to text at all.
    BurnIn {
        /// Which subtitle stream, counting only the subtitle streams.
        ///
        /// Not the stream's index in the container: both the `subtitles`
        /// filter's `si=` and the `[0:s:N]` specifier count subtitles alone, so
        /// a file whose only subtitles sit at container index 2 wants nought
        /// here. Passing the container index produced a filtergraph that
        /// matched no streams and a film that would not play.
        subtitle_index: u32,
        is_image_based: bool,
    },
}

/// Everything that decides what bytes come out, and therefore everything the
/// session cache is keyed on.
///
/// The output directory is deliberately absent: it is derived from this
/// specification's own hash, so two requests that would produce identical
/// output share a session rather than transcoding twice. Including the
/// directory would defeat that. See ADR-0011.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSpec {
    pub input_path: String,
    pub start_seconds: u32,
    pub segment_seconds: u32,
    pub hardware_accel: HardwareAccel,
    pub video: VideoAction,
    pub audio: AudioAction,
    /// Which audio stream to take, as ffprobe numbers it.
    ///
    /// Absent means whichever the container marks as default, which is what a
    /// viewer who has expressed no preference should get. Part of the session
    /// key, so choosing a different language produces a different session
    /// rather than quietly reusing the first one.
    #[serde(default)]
    pub audio_stream_index: Option<u32>,
    #[serde(default = "SubtitleAction::none")]
    pub subtitles: SubtitleAction,
    /// The source picture's size, when the caller knows it.
    ///
    /// A hardware scaler is given the exact output size rather than an
    /// expression: `scale_vt` takes no `force_original_aspect_ratio`, and what
    /// the others accept in that field differs between them and between
    /// `FFmpeg` releases. Working the size out here keeps one answer for every
    /// backend and lets it be tested without a GPU.
    ///
    /// Absent means the size is unknown, and a chain that would need to resize
    /// stays on the software filter rather than guessing.
    #[serde(default)]
    pub source_size: Option<(u32, u32)>,
}

impl SessionSpec {
    /// What this session is being asked to do, in one line for a log.
    ///
    /// A transcode that fails is read about after the fact, and "which file,
    /// to what, on what encoder" is the first question anybody asks.
    #[must_use]
    pub fn summary(&self) -> String {
        let video = match &self.video {
            VideoAction::Copy => "video=copy".to_owned(),
            VideoAction::Encode { encoder, .. } => format!("video={encoder}"),
        };

        let audio = match &self.audio {
            AudioAction::Copy => "audio=copy".to_owned(),
            AudioAction::Encode {
                encoder, channels, ..
            } => format!("audio={encoder}/{channels}ch"),
        };

        let subtitles = match &self.subtitles {
            SubtitleAction::None => "subs=none",
            SubtitleAction::BurnIn { .. } => "subs=burnIn",
        };

        format!(
            "{video} {audio} {subtitles} accel={:?} from={}s",
            self.hardware_accel, self.start_seconds
        )
    }
}

impl SubtitleAction {
    #[must_use]
    fn none() -> Self {
        Self::None
    }

    /// Whether drawing these subtitles needs a filter graph rather than a
    /// simple filter chain.
    ///
    /// Bitmap subtitles are a second video stream that has to be composited,
    /// which `-vf` cannot express.
    #[must_use]
    pub fn needs_filter_graph(&self) -> bool {
        matches!(
            self,
            Self::BurnIn {
                is_image_based: true,
                ..
            }
        )
    }
}

impl SessionSpec {
    /// A stable identifier for the output this specification produces.
    ///
    /// Content addressed rather than random so that a client reconnecting, or
    /// a second client asking for the same thing, reuses the segments already
    /// on disk. Stable across restarts, which a random id would not be.
    #[must_use]
    pub fn session_id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(self.input_path.as_bytes());
        hasher.update(self.start_seconds.to_be_bytes());
        hasher.update(self.segment_seconds.to_be_bytes());
        hasher.update(format!("{:?}", self.hardware_accel).as_bytes());
        hasher.update(format!("{:?}", self.video).as_bytes());
        hasher.update(format!("{:?}", self.audio).as_bytes());
        hasher.update(format!("{:?}", self.audio_stream_index).as_bytes());
        hasher.update(format!("{:?}", self.subtitles).as_bytes());
        hasher.update(format!("{:?}", self.source_size).as_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            let _ = write!(id, "{byte:02x}");
        }

        id
    }

    /// Whether this specification asks for hardware acceleration.
    #[must_use]
    pub fn uses_hardware(&self) -> bool {
        self.hardware_accel != HardwareAccel::None
    }

    /// The same specification with hardware acceleration removed.
    ///
    /// Used for the single automatic retry when a hardware encoder fails.
    /// A machine whose GPU is busy, or whose driver has fallen over, should
    /// still play the film. See ADR-0009.
    #[must_use]
    pub fn without_hardware(&self) -> Self {
        let video = match &self.video {
            VideoAction::Copy => VideoAction::Copy,
            VideoAction::Encode {
                encoder,
                max_bitrate_kbps,
                max_width,
                max_height,
                tone_map,
            } => VideoAction::Encode {
                encoder: software_equivalent(encoder).to_owned(),
                max_bitrate_kbps: *max_bitrate_kbps,
                max_width: *max_width,
                max_height: *max_height,
                tone_map: *tone_map,
            },
        };

        Self {
            hardware_accel: HardwareAccel::None,
            video,
            ..self.clone()
        }
    }
}

/// The filter chain that converts HDR to SDR.
///
/// The `zscale` route linearises the transfer curve, converts primaries to
/// BT.709, tone maps in linear light, then re-encodes the BT.709 curve. Each
/// step matters: skipping the linearisation is what produces the washed out
/// picture people recognise as "HDR played wrong".
#[must_use]
pub fn tone_map_filter(method: ToneMapping) -> Option<&'static str> {
    match method {
        ToneMapping::Zscale => Some(
            "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,\
tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv",
        ),
        ToneMapping::Libplacebo => Some(
            "libplacebo=tonemapping=bt.2390:colorspace=bt709:color_primaries=bt709:color_trc=bt709",
        ),
        ToneMapping::Unavailable => None,
    }
}

/// Escapes a path for use inside the `subtitles` filter.
///
/// The filter's own parser treats colons and backslashes as syntax, so a file
/// under a path containing either would otherwise be read as a malformed
/// filter rather than a filename.
#[must_use]
pub fn escape_filter_path(path: &str) -> String {
    path.replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
}

/// Builds a scale filter that shrinks but never enlarges.
///
/// `force_original_aspect_ratio=decrease` alone still scales *up* when the
/// client's limit is larger than the source, so a 640x480 file played on a
/// 1080p client would be upscaled to 1440x1080: more CPU, more bandwidth, and
/// not one pixel of extra detail. Clamping each axis to the input size first
/// makes the limit a ceiling rather than a target.
#[must_use]
pub fn scale_filter(max_width: u32, max_height: u32) -> String {
    format!(
        "scale=w='min(iw,{max_width})':h='min(ih,{max_height})':force_original_aspect_ratio=decrease"
    )
}

/// The software encoder that replaces a hardware one on fallback.
#[must_use]
pub fn software_equivalent(encoder: &str) -> &'static str {
    if encoder.starts_with("hevc") {
        return "libx265";
    }

    if encoder.starts_with("av1") {
        return "libsvtav1";
    }

    "libx264"
}

/// Whether this session can run without ever bringing frames back.
///
/// A single gate answering yes or no for the whole session, rather than
/// downloading and re-uploading around individual filters. That is the shape
/// Jellyfin settled on, and the reasoning holds here: the combinations that
/// force frames down are the ones a mixed chain gets wrong, and a chain that
/// is entirely one thing or entirely the other can be read and tested.
///
/// It says no when:
///
/// - the backend has no end-to-end pipeline, which is `Amf`, `Rkmpp` and no
///   acceleration at all;
/// - subtitles are being drawn on, since `subtitles` and `overlay` are
///   software only;
/// - HDR is being converted, since `zscale` and `tonemap` are software and
///   `libplacebo` is a different filter with its own setup;
/// - the picture has to be resized and nobody said how big it is, because the
///   hardware scalers need a number rather than an expression.
///
/// Saying no costs what Flux does today. Saying yes wrongly costs a session
/// that will not start, so each answer is a fact about the spec rather than a
/// guess about the machine.
#[must_use]
pub fn keeps_frames_on_the_gpu(spec: &SessionSpec) -> bool {
    if spec.hardware_accel.pipeline().is_none() {
        return false;
    }

    if !matches!(spec.subtitles, SubtitleAction::None) {
        return false;
    }

    match &spec.video {
        VideoAction::Copy => false,
        VideoAction::Encode { tone_map, .. } => tone_map.is_none() && spec.source_size.is_some(),
    }
}

/// The complete video filter chain.
///
/// Tone mapping runs before scaling: converting a smaller picture is cheaper,
/// but tone mapping the already-resampled result loses highlight detail that
/// the mapping curve needs.
#[must_use]
pub fn video_filter_chain(
    max_width: u32,
    max_height: u32,
    tone_map: Option<ToneMapping>,
    text_subtitles: Option<(&str, u32)>,
) -> String {
    let mut steps: Vec<String> = Vec::new();

    if let Some(filter) = tone_map.and_then(tone_map_filter) {
        steps.push(filter.to_owned());
    }

    steps.push(scale_filter(max_width, max_height));

    if let Some((path, index)) = text_subtitles {
        steps.push(format!(
            "subtitles='{}':si={index}",
            escape_filter_path(path)
        ));
    }

    steps.push("format=yuv420p".to_owned());

    steps.join(",")
}

/// What a backend needs to keep frames on the GPU from decode to encode.
///
/// Named per backend rather than derived, because the three parts do not
/// follow from each other: `NVENC` decodes as `cuda` and scales with
/// `scale_cuda`, `QSV` scales with `vpp_qsv` and is set up through a `VAAPI`
/// device on Linux, and `VideoToolbox` needs no device at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HardwarePipeline {
    /// What `-hwaccel_output_format` must be for frames to stay put.
    pub output_format: &'static str,
    /// The scaler that works on this backend's frames.
    pub scaler: &'static str,
}

impl HardwareAccel {
    /// The pipeline this backend can run end to end, if it can run one.
    ///
    /// `Amf` has none: its `-hwaccel` here is `d3d11va`, which is Windows only,
    /// and AMD on Linux goes through `VAAPI` instead — as ADR-0010 says, AMF
    /// there wants the closed `amdgpu-pro` driver. `Rkmpp` has none because
    /// nobody has tested one. Both keep working exactly as before, on the
    /// software filter chain.
    #[must_use]
    pub fn pipeline(self) -> Option<HardwarePipeline> {
        match self {
            Self::VideoToolbox => Some(HardwarePipeline {
                output_format: "videotoolbox_vld",
                scaler: "scale_vt",
            }),
            Self::Nvenc => Some(HardwarePipeline {
                output_format: "cuda",
                scaler: "scale_cuda",
            }),
            Self::Qsv => Some(HardwarePipeline {
                output_format: "qsv",
                scaler: "vpp_qsv",
            }),
            Self::Vaapi => Some(HardwarePipeline {
                output_format: "vaapi",
                scaler: "scale_vaapi",
            }),
            Self::None | Self::Amf | Self::Rkmpp => None,
        }
    }

    /// Whether a probe of this backend has to open a device first.
    ///
    /// Only VAAPI. It cannot open an encoder without one, which is the whole
    /// bug this exists to fix.
    ///
    /// QSV is deliberately excluded even though it derives from a VAAPI device
    /// when transcoding. Measured on an Intel iGPU, `h264_qsv` verifies with no
    /// device at all — it finds its own. Forcing a guessed path into its probe
    /// would reject a machine whose render node is `renderD129`, breaking
    /// hardware encoding on the one platform that already worked. The pipeline
    /// still shares a device; only the probe leaves well alone.
    #[must_use]
    pub fn needs_device_to_probe(self) -> bool {
        matches!(self, Self::Vaapi)
    }

    /// Whether this backend encodes from frames already on its own device.
    ///
    /// VAAPI will not take a software frame: it has to be uploaded first, which
    /// is why a probe for it needs `format=nv12,hwupload` where NVENC and
    /// `VideoToolbox` take the frame as it comes. QSV accepts either, and is left
    /// out so its probe stays the simpler of the two.
    #[must_use]
    pub fn needs_uploaded_frames(self) -> bool {
        matches!(self, Self::Vaapi)
    }

    /// The device arguments this backend needs before the input.
    ///
    /// `VAAPI` has to be pointed at a render node. `QSV` on Linux is a layer
    /// over `VAAPI`, so its device is derived from one rather than opened
    /// separately — that shared pool is what lets decode, scale and encode
    /// pass frames without copying. `NVENC` and `VideoToolbox` find their own.
    #[must_use]
    pub fn device_arguments(self, device: &str) -> Vec<String> {
        match self {
            Self::Vaapi => vec![
                "-init_hw_device".to_owned(),
                format!("vaapi=va:{device}"),
                "-filter_hw_device".to_owned(),
                "va".to_owned(),
            ],
            Self::Qsv => vec![
                "-init_hw_device".to_owned(),
                format!("vaapi=va:{device}"),
                "-init_hw_device".to_owned(),
                "qsv=qs@va".to_owned(),
                "-filter_hw_device".to_owned(),
                "qs".to_owned(),
            ],
            _ => Vec::new(),
        }
    }
}

/// The render node a `VAAPI` or `QSV` pipeline is opened on.
pub const DEFAULT_DEVICE: &str = "/dev/dri/renderD128";

/// Fits a picture inside a box without stretching it or growing it.
///
/// The software chain says this with `force_original_aspect_ratio=decrease`.
/// The hardware scalers do not all have that option, and the obvious
/// expression — clamping each axis on its own — silently squashes anything
/// whose shape differs from the box: a 1920x800 film asked to fit 1280x720
/// comes out 1280x720 rather than 1280x532. So the arithmetic happens here,
/// once, and every backend is handed the answer.
///
/// Both axes are rounded down to even numbers, which every encoder here needs
/// for chroma subsampling.
#[must_use]
pub fn fitted_size(source: (u32, u32), max_width: u32, max_height: u32) -> (u32, u32) {
    let (width, height) = source;

    if width == 0 || height == 0 {
        return (max_width & !1, max_height & !1);
    }

    let by_width = u64::from(width) * u64::from(max_height);
    let by_height = u64::from(height) * u64::from(max_width);
    let limited = by_width.min(by_height);

    let fitted_width = u32::try_from(limited / u64::from(height)).unwrap_or(max_width);
    let fitted_height = u32::try_from(limited / u64::from(width)).unwrap_or(max_height);

    (
        (fitted_width.min(width).max(2)) & !1,
        (fitted_height.min(height).max(2)) & !1,
    )
}

/// Keeps a source's closed captions out of an encode.
///
/// `h264_videotoolbox` carries A53 captions through by default and fails
/// outright on some sources that have them — "Unexpected end of SEI NAL Unit
/// parsing size" — which kills the whole session for a picture that would
/// otherwise encode. Flux delivers subtitles as separate tracks, so there was
/// never anything to preserve here.
///
/// Passed to every encoder rather than only the ones known to accept it. An
/// encoder without the option ignores it and carries on; ffmpeg says so above
/// `error` level, which is quieter than a list of encoder names that has to be
/// right for ever.
pub const NO_EMBEDDED_CAPTIONS: [&str; 2] = ["-a53cc", "0"];

/// A fully resolved transcode instruction.
///
/// The `FFmpeg` command line is always built from this struct and never
/// assembled from strings at call sites, so that invocations are
/// deterministic, unit testable without spawning a process, and loggable in
/// full for support. See ADR-0009.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranscodePlan {
    pub spec: SessionSpec,
    pub output_directory: String,
    /// The render node VAAPI and QSV are opened on.
    ///
    /// A property of the host rather than of the output, so it is deliberately
    /// not part of the session key: pointing Flux at a different card should
    /// not orphan every segment already on disk.
    pub device: String,
}

/// The manifest file every session writes.
pub const MANIFEST_NAME: &str = "index.m3u8";

/// The initialisation segment for fragmented MP4 output.
pub const INIT_SEGMENT_NAME: &str = "init.mp4";

impl TranscodePlan {
    /// Adds the video arguments, saying whether they mapped the streams.
    ///
    /// Compositing bitmap subtitles has to name its own inputs and output, so
    /// that branch maps the streams itself; every other route leaves it to the
    /// caller. Handing that fact back rather than working it out a second time
    /// downstream is what stops the two disagreeing and mapping the source
    /// video alongside the composited one.
    fn push_video_args(&self, args: &mut Vec<String>) -> bool {
        let mut is_mapped = false;

        match &self.spec.video {
            VideoAction::Copy => {
                args.push("-c:v".into());
                args.push("copy".into());
            }
            VideoAction::Encode {
                encoder,
                max_bitrate_kbps,
                max_width,
                max_height,
                tone_map,
            } => {
                args.push("-c:v".into());
                args.push(encoder.clone());
                args.push("-b:v".into());
                args.push(format!("{max_bitrate_kbps}k"));
                args.extend(
                    NO_EMBEDDED_CAPTIONS
                        .iter()
                        .map(|argument| (*argument).to_owned()),
                );
                if let (true, Some(pipeline), Some(source)) = (
                    keeps_frames_on_the_gpu(&self.spec),
                    self.spec.hardware_accel.pipeline(),
                    self.spec.source_size,
                ) {
                    let (width, height) = fitted_size(source, *max_width, *max_height);

                    args.push("-vf".into());
                    args.push(format!("{}=w={width}:h={height}", pipeline.scaler));

                    return is_mapped;
                }

                let text_burn_in = match &self.spec.subtitles {
                    SubtitleAction::BurnIn {
                        subtitle_index,
                        is_image_based: false,
                    } => Some((self.spec.input_path.as_str(), *subtitle_index)),
                    _ => None,
                };

                let chain = video_filter_chain(*max_width, *max_height, *tone_map, text_burn_in);

                if let SubtitleAction::BurnIn {
                    subtitle_index,
                    is_image_based: true,
                } = &self.spec.subtitles
                {
                    args.push("-filter_complex".into());
                    args.push(format!(
                        "[0:v]{chain}[base];[base][0:s:{subtitle_index}]overlay[v]"
                    ));
                    args.push("-map".into());
                    args.push("[v]".into());
                    args.push("-map".into());
                    args.push(match self.spec.audio_stream_index {
                        Some(index) => format!("0:{index}"),
                        None => "0:a?".into(),
                    });

                    is_mapped = true;
                } else {
                    args.push("-vf".into());
                    args.push(chain);
                }
            }
        }

        is_mapped
    }

    /// Builds the `FFmpeg` argument vector for this plan.
    #[must_use]
    pub fn to_ffmpeg_args(&self) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "-hide_banner".into(),
            "-nostdin".into(),
            "-loglevel".into(),
            "error".into(),
        ];

        let on_the_gpu = keeps_frames_on_the_gpu(&self.spec);

        if on_the_gpu {
            args.extend(self.spec.hardware_accel.device_arguments(&self.device));
        }

        if let Some(flag) = self.spec.hardware_accel.ffmpeg_flag() {
            args.push("-hwaccel".into());
            args.push(flag.into());
        }

        if on_the_gpu {
            if let Some(pipeline) = self.spec.hardware_accel.pipeline() {
                args.push("-hwaccel_output_format".into());
                args.push(pipeline.output_format.into());
            }
        }

        if self.spec.start_seconds > 0 {
            args.push("-ss".into());
            args.push(self.spec.start_seconds.to_string());
        }

        args.push("-i".into());
        args.push(self.spec.input_path.clone());

        let is_mapped = self.push_video_args(&mut args);

        if let Some(index) = self.spec.audio_stream_index {
            if !is_mapped {
                args.push("-map".into());
                args.push("0:v:0".into());
                args.push("-map".into());
                args.push(format!("0:{index}"));
            }
        }

        match &self.spec.audio {
            AudioAction::Copy => {
                args.push("-c:a".into());
                args.push("copy".into());
            }
            AudioAction::Encode {
                encoder,
                channels,
                max_bitrate_kbps,
            } => {
                args.push("-c:a".into());
                args.push(encoder.clone());
                args.push("-ac".into());
                args.push(channels.to_string());
                args.push("-b:a".into());
                args.push(format!("{max_bitrate_kbps}k"));
            }
        }

        args.push("-f".into());
        args.push("hls".into());
        args.push("-hls_time".into());
        args.push(self.spec.segment_seconds.to_string());
        args.push("-hls_playlist_type".into());
        args.push("event".into());
        args.push("-hls_segment_type".into());
        args.push("fmp4".into());
        args.push("-hls_list_size".into());
        args.push("0".into());
        args.push("-hls_fmp4_init_filename".into());
        args.push(INIT_SEGMENT_NAME.into());
        args.push("-hls_segment_filename".into());
        args.push(format!("{}/segment%05d.m4s", self.output_directory));
        args.push(format!("{}/{MANIFEST_NAME}", self.output_directory));

        args
    }
}

#[cfg(test)]
mod tests {
    use super::{
        fitted_size, keeps_frames_on_the_gpu, software_equivalent, AudioAction, HardwareAccel,
        SessionSpec, SubtitleAction, ToneMapping, TranscodePlan, VideoAction, DEFAULT_DEVICE,
    };

    fn spec() -> SessionSpec {
        SessionSpec {
            input_path: "/media/film.mkv".into(),
            start_seconds: 0,
            segment_seconds: 4,
            hardware_accel: HardwareAccel::None,
            video: VideoAction::Copy,
            audio: AudioAction::Copy,
            audio_stream_index: None,
            subtitles: SubtitleAction::None,
            source_size: None,
        }
    }

    fn on_gpu(accel: HardwareAccel) -> SessionSpec {
        SessionSpec {
            hardware_accel: accel,
            source_size: Some((1920, 800)),
            video: VideoAction::Encode {
                encoder: "h264".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: None,
            },
            ..spec()
        }
    }

    #[test]
    fn fits_a_wide_picture_without_squashing_it() {
        assert_eq!(fitted_size((1920, 800), 1280, 720), (1280, 532));
    }

    #[test]
    fn fits_a_tall_picture_by_its_height() {
        assert_eq!(fitted_size((1440, 1080), 1280, 720), (960, 720));
    }

    #[test]
    fn never_grows_a_small_picture() {
        assert_eq!(fitted_size((640, 480), 1920, 1080), (640, 480));
    }

    #[test]
    fn keeps_both_axes_even() {
        let (width, height) = fitted_size((1919, 803), 1280, 720);

        assert_eq!(width % 2, 0);
        assert_eq!(height % 2, 0);
    }

    #[test]
    fn survives_a_source_of_no_size() {
        assert_eq!(fitted_size((0, 0), 1280, 720), (1280, 720));
    }

    #[test]
    fn keeps_frames_on_the_gpu_for_a_plain_rescale() {
        assert!(keeps_frames_on_the_gpu(&on_gpu(
            HardwareAccel::VideoToolbox
        )));
    }

    #[test]
    fn comes_back_down_to_draw_subtitles() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: false,
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu(&spec));
    }

    #[test]
    fn comes_back_down_to_tone_map() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Zscale),
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu(&spec));
    }

    #[test]
    fn will_not_guess_a_size_it_was_not_given() {
        let spec = SessionSpec {
            source_size: None,
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu(&spec));
    }

    #[test]
    fn leaves_backends_with_no_pipeline_alone() {
        for accel in [
            HardwareAccel::Amf,
            HardwareAccel::Rkmpp,
            HardwareAccel::None,
        ] {
            assert!(
                !keeps_frames_on_the_gpu(&on_gpu(accel)),
                "{accel:?} has no end to end pipeline"
            );
        }
    }

    #[test]
    fn opens_the_device_it_was_given_rather_than_a_fixed_one() {
        let plan = TranscodePlan {
            spec: on_gpu(HardwareAccel::Vaapi),
            output_directory: "/transcodes/abc".into(),
            device: "/dev/dri/renderD129".into(),
        };

        assert!(plan
            .to_ffmpeg_args()
            .windows(2)
            .any(|pair| pair == ["-init_hw_device", "vaapi=va:/dev/dri/renderD129"]));
    }

    #[test]
    fn a_copy_needs_no_pipeline() {
        let spec = SessionSpec {
            video: VideoAction::Copy,
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu(&spec));
    }

    #[test]
    fn names_the_output_format_so_frames_stay_put() {
        let args = plan(on_gpu(HardwareAccel::VideoToolbox)).to_ffmpeg_args();

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-hwaccel_output_format", "videotoolbox_vld"]));
    }

    #[test]
    fn scales_on_the_backends_own_filter() {
        let cases = [
            (HardwareAccel::VideoToolbox, "scale_vt=w=1280:h=532"),
            (HardwareAccel::Nvenc, "scale_cuda=w=1280:h=532"),
            (HardwareAccel::Qsv, "vpp_qsv=w=1280:h=532"),
            (HardwareAccel::Vaapi, "scale_vaapi=w=1280:h=532"),
        ];

        for (accel, expected) in cases {
            let args = plan(on_gpu(accel)).to_ffmpeg_args();
            let filters = args
                .iter()
                .position(|argument| argument == "-vf")
                .and_then(|at| args.get(at + 1))
                .expect("a filter chain");

            assert_eq!(filters, expected, "{accel:?}");
        }
    }

    #[test]
    fn opens_a_render_node_for_the_backends_that_need_one() {
        let args = plan(on_gpu(HardwareAccel::Vaapi)).to_ffmpeg_args();

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-init_hw_device", "vaapi=va:/dev/dri/renderD128"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-filter_hw_device", "va"]));
    }

    #[test]
    fn derives_the_qsv_device_from_a_vaapi_one() {
        let args = plan(on_gpu(HardwareAccel::Qsv)).to_ffmpeg_args();

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-init_hw_device", "vaapi=va:/dev/dri/renderD128"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-init_hw_device", "qsv=qs@va"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-filter_hw_device", "qs"]));
    }

    #[test]
    fn asks_for_no_device_where_none_is_needed() {
        for accel in [HardwareAccel::VideoToolbox, HardwareAccel::Nvenc] {
            let args = plan(on_gpu(accel)).to_ffmpeg_args();

            assert!(
                !args.iter().any(|argument| argument == "-init_hw_device"),
                "{accel:?} finds its own device"
            );
        }
    }

    #[test]
    fn a_software_chain_is_left_exactly_as_it_was() {
        let spec = SessionSpec {
            source_size: None,
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        let args = plan(spec).to_ffmpeg_args();
        let filters = args
            .iter()
            .position(|argument| argument == "-vf")
            .and_then(|at| args.get(at + 1))
            .expect("a filter chain");

        assert!(filters.contains("force_original_aspect_ratio=decrease"));
        assert!(filters.contains("format=yuv420p"));
        assert!(!args
            .iter()
            .any(|argument| argument == "-hwaccel_output_format"));
    }

    #[test]
    fn a_different_source_size_is_a_different_session() {
        let one = on_gpu(HardwareAccel::VideoToolbox);
        let other = SessionSpec {
            source_size: Some((1920, 1080)),
            ..one.clone()
        };

        assert_ne!(one.session_id(), other.session_id());
    }

    fn plan(spec: SessionSpec) -> TranscodePlan {
        TranscodePlan {
            device: DEFAULT_DEVICE.to_owned(),
            spec,
            output_directory: "/transcodes/abc".into(),
        }
    }

    #[test]
    fn copies_both_streams_when_nothing_needs_encoding() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-c:v", "copy"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn keeps_a_sources_captions_out_of_an_encode() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_videotoolbox".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-a53cc", "0"]));
    }

    #[test]
    fn leaves_a_copied_stream_alone() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument == "-a53cc"));
    }

    #[test]
    fn omits_hwaccel_flag_when_none() {
        assert!(!plan(spec())
            .to_ffmpeg_args()
            .iter()
            .any(|a| a == "-hwaccel"));
    }

    #[test]
    fn includes_hwaccel_flag_when_available() {
        let args = plan(SessionSpec {
            hardware_accel: HardwareAccel::VideoToolbox,
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-hwaccel", "videotoolbox"]));
    }

    #[test]
    fn copies_audio_when_only_video_is_encoded() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_videotoolbox".into(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-c:v", "h264_videotoolbox"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn seeks_before_the_input_so_the_seek_is_fast() {
        let args = plan(SessionSpec {
            start_seconds: 90,
            ..spec()
        })
        .to_ffmpeg_args();

        let seek = args.iter().position(|a| a == "-ss");
        let input = args.iter().position(|a| a == "-i");

        assert!(seek < input, "expected -ss before -i");
    }

    #[test]
    fn omits_the_seek_when_starting_at_zero() {
        assert!(!plan(spec()).to_ffmpeg_args().iter().any(|a| a == "-ss"));
    }

    #[test]
    fn writes_fragmented_hls_into_the_session_directory() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-hls_segment_type", "fmp4"]));
        assert!(args.contains(&"/transcodes/abc/segment%05d.m4s".to_owned()));
        assert!(args.contains(&"/transcodes/abc/index.m3u8".to_owned()));
    }

    #[test]
    fn keeps_every_segment_in_the_playlist() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-hls_list_size", "0"]));
    }

    #[test]
    fn writes_the_playlist_as_it_goes_rather_than_only_at_the_end() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args
            .windows(2)
            .any(|w| w == ["-hls_playlist_type", "event"]));
        assert!(!args.iter().any(|argument| argument == "vod"));
    }

    #[test]
    fn tone_mapping_linearises_before_mapping() {
        use super::{tone_map_filter, ToneMapping};

        let filter = tone_map_filter(ToneMapping::Zscale).expect("zscale is available");
        let linearise = filter.find("t=linear").expect("linearises");
        let map = filter.find("tonemap=").expect("maps");

        assert!(
            linearise < map,
            "must linearise before tone mapping: {filter}"
        );
    }

    #[test]
    fn tone_mapping_converts_primaries_to_bt709() {
        use super::{tone_map_filter, ToneMapping};

        let filter = tone_map_filter(ToneMapping::Zscale).expect("zscale is available");

        assert!(
            filter.contains("p=bt709"),
            "expected primaries conversion: {filter}"
        );
        assert!(
            filter.contains("m=bt709"),
            "expected matrix conversion: {filter}"
        );
    }

    #[test]
    fn a_build_without_the_filters_offers_no_chain() {
        use super::{tone_map_filter, ToneMapping};

        assert!(tone_map_filter(ToneMapping::Unavailable).is_none());
    }

    #[test]
    fn tone_maps_before_scaling_to_keep_highlight_detail() {
        use super::{video_filter_chain, ToneMapping};

        let chain = video_filter_chain(1920, 1080, Some(ToneMapping::Zscale), None);
        let map = chain.find("tonemap=").expect("maps");
        let scale = chain.find("scale=w=").expect("scales");

        assert!(map < scale, "tone mapping must precede scaling: {chain}");
    }

    #[test]
    fn omits_tone_mapping_when_it_is_not_needed() {
        use super::video_filter_chain;

        let chain = video_filter_chain(1920, 1080, None, None);

        assert!(
            !chain.contains("tonemap"),
            "expected no tone mapping: {chain}"
        );
        assert!(chain.contains("format=yuv420p"));
    }

    #[test]
    fn never_upscales_beyond_the_source() {
        use super::scale_filter;

        let filter = scale_filter(1920, 1080);

        assert!(
            filter.contains("min(iw,1920)"),
            "expected a width ceiling: {filter}"
        );
        assert!(
            filter.contains("min(ih,1080)"),
            "expected a height ceiling: {filter}"
        );
    }

    #[test]
    fn keeps_the_aspect_ratio_when_shrinking() {
        use super::scale_filter;

        assert!(scale_filter(1280, 720).contains("force_original_aspect_ratio=decrease"));
    }

    #[test]
    fn draws_text_subtitles_after_scaling() {
        use super::video_filter_chain;

        let chain = video_filter_chain(1920, 1080, None, Some(("/media/film.mkv", 2)));
        let scale = chain.find("scale=w=").expect("scales");
        let subs = chain.find("subtitles=").expect("draws subtitles");

        assert!(
            scale < subs,
            "subtitles must be drawn at output size: {chain}"
        );
        assert!(chain.contains("si=2"));
    }

    #[test]
    fn escapes_a_path_the_filter_parser_would_misread() {
        use super::escape_filter_path;

        assert_eq!(
            escape_filter_path("/media/C:/film.mkv"),
            "/media/C\\:/film.mkv"
        );
    }

    #[test]
    fn composites_bitmap_subtitles_in_a_filter_graph() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 2,
                is_image_based: true,
            },
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.iter().any(|a| a == "-filter_complex"));
        assert!(args.iter().any(|a| a.contains("[0:s:2]overlay")));
        assert!(
            !args.iter().any(|a| a == "-vf"),
            "a graph replaces the chain"
        );
    }

    #[test]
    fn maps_each_stream_once_when_compositing_over_a_chosen_audio_track() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            audio_stream_index: Some(1),
            ..spec()
        })
        .to_ffmpeg_args();

        assert_eq!(
            args.iter().filter(|a| *a == "-map").count(),
            2,
            "mapping the source video alongside the composited one puts two \
             video tracks in the output"
        );
        assert!(
            !args.iter().any(|a| a == "0:v:0"),
            "the composited graph is the video, not the source"
        );
    }

    #[test]
    fn sends_the_chosen_audio_track_through_the_graph_rather_than_all_of_them() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            audio_stream_index: Some(2),
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.iter().any(|a| a == "0:2"));
        assert!(!args.iter().any(|a| a == "0:a?"));
    }

    #[test]
    fn takes_every_audio_track_when_none_was_chosen() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.iter().any(|a| a == "0:a?"));
    }

    #[test]
    fn uses_a_plain_chain_for_text_subtitles() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 3,
                is_image_based: false,
            },
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.iter().any(|a| a == "-vf"));
        assert!(args.iter().any(|a| a.contains("subtitles=")));
    }

    #[test]
    fn burning_in_different_subtitles_is_a_different_session() {
        let with_subs = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 2,
                is_image_based: false,
            },
            ..spec()
        };

        assert_ne!(spec().session_id(), with_subs.session_id());
    }

    #[test]
    fn reports_when_subtitles_need_a_filter_graph() {
        assert!(SubtitleAction::BurnIn {
            subtitle_index: 0,
            is_image_based: true
        }
        .needs_filter_graph());
        assert!(!SubtitleAction::BurnIn {
            subtitle_index: 0,
            is_image_based: false
        }
        .needs_filter_graph());
        assert!(!SubtitleAction::None.needs_filter_graph());
    }

    #[test]
    fn is_deterministic() {
        let subject = plan(spec());

        assert_eq!(subject.to_ffmpeg_args(), subject.to_ffmpeg_args());
    }

    #[test]
    fn identical_specifications_share_a_session_id() {
        assert_eq!(spec().session_id(), spec().session_id());
    }

    #[test]
    fn a_different_seek_is_a_different_session() {
        let other = SessionSpec {
            start_seconds: 30,
            ..spec()
        };

        assert_ne!(spec().session_id(), other.session_id());
    }

    #[test]
    fn a_different_encode_is_a_different_session() {
        let other = SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1280,
                max_height: 720,
                tone_map: None,
            },
            ..spec()
        };

        assert_ne!(spec().session_id(), other.session_id());
    }

    #[test]
    fn session_ids_are_filesystem_safe() {
        let id = spec().session_id();

        assert_eq!(id.len(), 32);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn falling_back_drops_hardware_and_swaps_the_encoder() {
        let hardware = SessionSpec {
            hardware_accel: HardwareAccel::VideoToolbox,
            video: VideoAction::Encode {
                encoder: "hevc_videotoolbox".into(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            ..spec()
        };

        let fallback = hardware.without_hardware();

        assert_eq!(fallback.hardware_accel, HardwareAccel::None);
        assert_eq!(
            fallback.video,
            VideoAction::Encode {
                encoder: "libx265".into(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            }
        );
    }

    #[test]
    fn falling_back_leaves_a_stream_copy_alone() {
        let fallback = SessionSpec {
            hardware_accel: HardwareAccel::Nvenc,
            ..spec()
        }
        .without_hardware();

        assert_eq!(fallback.video, VideoAction::Copy);
    }

    #[test]
    fn maps_hardware_encoders_onto_software_ones() {
        assert_eq!(software_equivalent("hevc_nvenc"), "libx265");
        assert_eq!(software_equivalent("av1_qsv"), "libsvtav1");
        assert_eq!(software_equivalent("h264_vaapi"), "libx264");
    }

    #[test]
    fn reports_whether_hardware_is_requested() {
        assert!(!spec().uses_hardware());
        assert!(SessionSpec {
            hardware_accel: HardwareAccel::Qsv,
            ..spec()
        }
        .uses_hardware());
    }

    #[test]
    fn leaves_stream_selection_to_ffmpeg_when_no_track_was_chosen() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument.starts_with("0:1")));
    }

    #[test]
    fn maps_the_audio_stream_a_viewer_chose() {
        let chosen = SessionSpec {
            audio_stream_index: Some(3),
            ..spec()
        };

        let args = plan(chosen).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-map", "0:3"]));
        assert!(args.windows(2).any(|w| w == ["-map", "0:v:0"]));
    }

    #[test]
    fn choosing_a_different_track_is_a_different_session() {
        let first = SessionSpec {
            audio_stream_index: Some(1),
            ..spec()
        };
        let second = SessionSpec {
            audio_stream_index: Some(2),
            ..spec()
        };

        assert_ne!(first.session_id(), second.session_id());
    }
}
