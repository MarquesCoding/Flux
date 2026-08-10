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
        stream_index: u32,
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
    #[serde(default = "SubtitleAction::none")]
    pub subtitles: SubtitleAction,
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
        hasher.update(format!("{:?}", self.subtitles).as_bytes());

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

    // Drawn after scaling so the text is rendered at output resolution rather
    // than scaled along with the picture, which would soften it.
    if let Some((path, index)) = text_subtitles {
        steps.push(format!(
            "subtitles='{}':si={index}",
            escape_filter_path(path)
        ));
    }

    steps.push("format=yuv420p".to_owned());

    steps.join(",")
}

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
}

/// The manifest file every session writes.
pub const MANIFEST_NAME: &str = "index.m3u8";

/// The initialisation segment for fragmented MP4 output.
pub const INIT_SEGMENT_NAME: &str = "init.mp4";

impl TranscodePlan {
    /// Builds the `FFmpeg` argument vector for this plan.
    #[must_use]
    pub fn to_ffmpeg_args(&self) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "-hide_banner".into(),
            "-nostdin".into(),
            "-loglevel".into(),
            "error".into(),
        ];

        if let Some(flag) = self.spec.hardware_accel.ffmpeg_flag() {
            args.push("-hwaccel".into());
            args.push(flag.into());
        }

        if self.spec.start_seconds > 0 {
            args.push("-ss".into());
            args.push(self.spec.start_seconds.to_string());
        }

        args.push("-i".into());
        args.push(self.spec.input_path.clone());

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
                let text_burn_in = match &self.spec.subtitles {
                    SubtitleAction::BurnIn {
                        stream_index,
                        is_image_based: false,
                    } => Some((self.spec.input_path.as_str(), *stream_index)),
                    _ => None,
                };

                let chain = video_filter_chain(*max_width, *max_height, *tone_map, text_burn_in);

                if let SubtitleAction::BurnIn {
                    stream_index,
                    is_image_based: true,
                } = &self.spec.subtitles
                {
                    // Bitmap subtitles are a second video stream, so they have
                    // to be composited in a filter graph rather than a chain.
                    args.push("-filter_complex".into());
                    args.push(format!(
                        "[0:v]{chain}[base];[base][0:s:{stream_index}]overlay[v]"
                    ));
                    args.push("-map".into());
                    args.push("[v]".into());
                    args.push("-map".into());
                    args.push("0:a?".into());
                } else {
                    args.push("-vf".into());
                    args.push(chain);
                }
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
        args.push("vod".into());
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
        software_equivalent, AudioAction, HardwareAccel, SessionSpec, SubtitleAction,
        TranscodePlan, VideoAction,
    };

    fn spec() -> SessionSpec {
        SessionSpec {
            input_path: "/media/film.mkv".into(),
            start_seconds: 0,
            segment_seconds: 4,
            hardware_accel: HardwareAccel::None,
            video: VideoAction::Copy,
            audio: AudioAction::Copy,
            subtitles: SubtitleAction::None,
        }
    }

    fn plan(spec: SessionSpec) -> TranscodePlan {
        TranscodePlan {
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
        assert!(args.windows(2).any(|w| w == ["-hls_playlist_type", "vod"]));
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
                stream_index: 2,
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
                stream_index: 3,
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
                stream_index: 2,
                is_image_based: false,
            },
            ..spec()
        };

        assert_ne!(spec().session_id(), with_subs.session_id());
    }

    #[test]
    fn reports_when_subtitles_need_a_filter_graph() {
        assert!(SubtitleAction::BurnIn {
            stream_index: 0,
            is_image_based: true
        }
        .needs_filter_graph());
        assert!(!SubtitleAction::BurnIn {
            stream_index: 0,
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
}
