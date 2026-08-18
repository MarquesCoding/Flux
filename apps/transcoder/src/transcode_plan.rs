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

/// What a segment is wrapped in.
///
/// A property of the treatment rather than of Flux. Transport streams were the
/// one global answer for a while because a copied open-GOP HEVC film stopped
/// twenty-three seconds in as fragmented MP4 — but the container was never the
/// fault. Measured against that same film: HEVC Main 10 in fragmented MP4 plays
/// every frame when its segments open on an IDR, and stops when they open on a
/// CRA carrying pictures that reference the GOP before it. See
/// [`crate::keyframes::Cut::is_safe`], which is where those cuts are refused,
/// and FLUX-124.
///
/// So fragmented MP4 is the default, and the reasons to want it are the ones
/// transport streams cannot give: AV1 has no practical mapping into TS at all,
/// nor do Opus and FLAC, and Apple's HLS authoring rules require fMP4 for HEVC,
/// which is the whole native path on iOS and tvOS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SegmentContainer {
    /// Fragmented MP4, described by an `EXT-X-MAP` and an initialisation
    /// segment every run rewrites.
    #[default]
    Fmp4,
    /// MPEG-TS, for a client that cannot take fragmented MP4.
    ///
    /// Kept reachable rather than kept as the default: a segment carries its
    /// own timing, so there is no initialisation segment to fetch first, and
    /// some devices accept nothing else. See FLUX-115.
    MpegTs,
}

impl SegmentContainer {
    /// What a segment of this container is called on disk.
    #[must_use]
    pub fn extension(self) -> &'static str {
        match self {
            Self::Fmp4 => "m4s",
            Self::MpegTs => "ts",
        }
    }

    /// Whether the player has to fetch an initialisation segment first.
    #[must_use]
    pub fn needs_init_segment(self) -> bool {
        matches!(self, Self::Fmp4)
    }
}

/// The initialisation segment a fragmented MP4 playlist points at.
///
/// One per plan rather than one per run: every run of a plan encodes the same
/// treatment, so the parameter sets it describes are the same, and a player
/// that has fetched it once should not have to fetch it again when a seek
/// starts a new run.
pub const INIT_SEGMENT_NAME: &str = "init.mp4";

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
    /// What to wrap the segments in.
    ///
    /// Negotiated rather than fixed, because it is a fact about the client:
    /// what it will accept is the only thing that decides it. Absent means
    /// fragmented MP4, so a caller written before this existed keeps working
    /// and gets the container that carries the most.
    #[serde(default)]
    pub container: SegmentContainer,
    /// What the source video is, where the caller knows it.
    ///
    /// Read only when copying, and only to tag the output. A copied HEVC
    /// stream must be marked `hvc1` in fragmented MP4: `hev1` is the other
    /// legal marking, it is what `FFmpeg` writes unasked, and a player given it
    /// shows a black picture and plays the sound. Absent means the tag is left
    /// alone, which is right for every codec that has only one.
    #[serde(default)]
    pub source_video_codec: Option<String>,
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
            "{video} {audio} {subtitles} accel={:?} container={:?} from={}s",
            self.hardware_accel, self.container, self.start_seconds
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
        hasher.update(format!("{:?}", self.container).as_bytes());

        let digest = hasher.finalize();
        let mut id = String::with_capacity(32);

        for byte in digest.iter().take(16) {
            let _ = write!(id, "{byte:02x}");
        }

        id
    }

    /// A stable identifier for the treatment, wherever playback begins.
    ///
    /// Everything [`session_id`](Self::session_id) hashes except where the
    /// viewer joined, which is the whole difference. Two people watching the
    /// same film at the same quality get the same plan even if one started at
    /// the beginning and the other forty minutes in, so the segments one of
    /// them causes to be produced are the segments the other finds waiting.
    ///
    /// This is the address ADR-0011 asks for. Keying the work on where playback
    /// started is what makes a seek a new transcode of the remainder rather
    /// than a request for a segment.
    #[must_use]
    pub fn plan_id(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(self.input_path.as_bytes());
        hasher.update(self.segment_seconds.to_be_bytes());
        hasher.update(format!("{:?}", self.hardware_accel).as_bytes());
        hasher.update(format!("{:?}", self.video).as_bytes());
        hasher.update(format!("{:?}", self.audio).as_bytes());
        hasher.update(format!("{:?}", self.audio_stream_index).as_bytes());
        hasher.update(format!("{:?}", self.subtitles).as_bytes());
        hasher.update(format!("{:?}", self.source_size).as_bytes());
        hasher.update(format!("{:?}", self.container).as_bytes());

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

/// How frames travel from the decoder to the encoder.
///
/// This began as one gate answering yes or no for the whole session, on the
/// reasoning that a chain entirely one thing or entirely the other can be read
/// and tested. That held while the only alternative was a fully software
/// chain, and it cost far too much: a single burned-in subtitle sent the
/// decode, the scale and every frame back through system memory, when only the
/// one filter needed to be there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrameRoute {
    /// Decoded, scaled and encoded without ever leaving the device.
    OnDevice,
    /// On the device, down for the one filter that needs system memory, back up
    /// for the encoder.
    ///
    /// The scale happens before the descent, so what crosses the bus is the
    /// output picture rather than the source — and a subtitle is drawn at the
    /// size it will be watched at rather than shrunk afterwards.
    DownAndBack,
    /// The video never leaves the device; the subtitle is uploaded to meet it.
    ///
    /// Better than `DownAndBack` at the same job, because what crosses the bus
    /// is the overlay rather than the film. A bitmap subtitle is a small
    /// picture that changes a few times a minute, and text is drawn onto a
    /// transparent canvas of the same size — either way the video stays put.
    Composited,
    /// System memory throughout, which is what Flux did everywhere.
    InSoftware,
}

impl FrameRoute {
    /// Whether the decoder should hand back device frames.
    ///
    /// True for every hardware route. `DownAndBack` still decodes on the
    /// device — it comes down later and by choice, which is the whole
    /// difference between it and `InSoftware`.
    #[must_use]
    pub fn decodes_on_the_device(self) -> bool {
        !matches!(self, Self::InSoftware)
    }
}

/// How often the transparent canvas carrying text subtitles is redrawn.
///
/// Text has no framerate of its own, so the canvas needs one chosen for it.
/// Jellyfin drops plain subtitles to ten a second and follows the video for
/// `ASS`, which can animate; Flux does not currently carry the subtitle codec
/// or the source framerate this far, so it uses the figure Jellyfin falls back
/// to when it does not know either. Raising it costs software rendering of the
/// overlay and nothing on the device.
const TEXT_OVERLAY_FPS: u32 = 25;

/// Brings a bitmap subtitle to the size of the picture it is drawn onto.
///
/// A subtitle stream carries its own canvas, and that canvas is the size the
/// disc was authored at rather than the size of the video beside it. Overlaid
/// untouched it is placed at the origin, so a canvas taller than the picture
/// puts the text — which sits near the bottom of it — below the frame, where it
/// is never seen. Measured on the reference library: 161 of the 566 files whose
/// bitmap subtitles declare a canvas declare one larger than their own picture,
/// and any session that scales down makes the rest of them larger too.
///
/// Padded rather than stretched, and centred, because the canvas and the
/// picture need not share an aspect ratio. This is the general form, which is
/// also what Jellyfin uses whenever it cannot compare the two.
///
/// Ends without a sink so that a caller can add its own: the device route
/// converts and uploads the result, and the software route takes it as it is.
fn bitmap_subtitle_branch(subtitle_index: u32, width: u32, height: u32) -> String {
    format!(
        "[0:s:{subtitle_index}]scale,scale=-1:{height}:fast_bilinear,crop,\
         pad=max({width}\\,iw):max({height}\\,ih):(ow-iw)/2:(oh-ih)/2:black@0,\
         crop={width}:{height}"
    )
}

/// The filter graph that draws subtitles on without bringing the video down.
///
/// Both kinds end the same way — a picture in the compositor's format, uploaded
/// to the device, drawn onto frames that never left it. They differ only in
/// where that picture comes from: a bitmap subtitle is already one, and text is
/// rendered onto a transparent canvas by the same `subtitles` filter that used
/// to be pointed at the video itself. `sub2video=1` is what makes it draw onto
/// the canvas rather than expecting frames to write over.
///
/// The bitmap branch pads to the output size rather than trusting the subtitle
/// to share the video's aspect ratio. `SubtitleAction` does not carry the
/// subtitle's own dimensions, so this takes the general form, which is also
/// what Jellyfin uses whenever it cannot compare the two.
fn composited_graph(
    scale: &str,
    pipeline: HardwarePipeline,
    subtitles: &SubtitleAction,
    input_path: &str,
    width: u32,
    height: u32,
) -> Option<String> {
    let SubtitleAction::BurnIn {
        subtitle_index,
        is_image_based,
    } = subtitles
    else {
        return None;
    };

    let overlay = format!("{}=eof_action=pass:repeatlast=0", pipeline.overlay);
    let format = pipeline.overlay_format;
    let upload = pipeline.overlay_upload;

    let subtitle_branch = if *is_image_based {
        format!(
            "{},format={format},{upload}[sub]",
            bitmap_subtitle_branch(*subtitle_index, width, height)
        )
    } else {
        format!(
            "alphasrc=s={width}x{height}:r={TEXT_OVERLAY_FPS},format={format},\
             subtitles='{}':si={subtitle_index}:alpha=1:sub2video=1,{upload}[sub]",
            escape_filter_path(input_path)
        )
    };

    Some(format!(
        "[0:v]{scale}[base];{subtitle_branch};[base][sub]{overlay}[v]"
    ))
}

/// Which of the filters Flux needs this build actually has.
///
/// Both are properties of how `FFmpeg` was compiled rather than of the
/// hardware, and having one does not imply the other: a stock macOS build has
/// `scale_vt` and no `overlay_videotoolbox`, because that filter is a patch
/// flux-ffmpeg carries. Asking separately keeps such a build on the route it
/// can actually run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DeviceFilters {
    pub scaler: bool,
    pub overlay: bool,
    pub tone_map: bool,
}

/// The name of a filter, given the expression that configures it.
///
/// A build either has a filter or it does not, and what it has is the name —
/// so a probe compares names while a chain carries options. An expression is
/// `name=options`, so the name is everything before the first `=`.
#[must_use]
pub fn filter_name(expression: &str) -> &str {
    expression.split('=').next().unwrap_or(expression)
}

/// Which route this session can take.
///
/// `InSoftware` when:
///
/// - this build has no scaler for the backend's frames;
/// - the backend has no end-to-end pipeline, which is `Amf` and no
///   acceleration at all;
/// - nothing is being encoded, so there is no chain to place;
/// - HDR is being converted, since `zscale` and `tonemap` are software and
///   `libplacebo` is a different filter with its own setup;
/// - HDR is being converted and this backend has no tone mapper of its own, or
///   the build does not have it — the conversion has to happen before the
///   picture is resampled, so a round trip around it would drag the scale down
///   with it and there would be nothing left on the device to save;
/// - the picture has to be resized and nobody said how big it is, because the
///   hardware scalers need a number rather than an expression.
///
/// With subtitles to burn in, `Composited` when the build has the backend's
/// compositor, and `DownAndBack` when it does not but the subtitles are text —
/// the one software filter that fits in a linear chain. A bitmap subtitle
/// cannot be drawn that way at all: it is a second stream, so without a
/// compositor there is nowhere for it to go but software.
///
/// Saying `InSoftware` costs what Flux did before. Saying anything else
/// wrongly costs a session that will not start, so each answer is a fact about
/// the spec rather than a guess about the machine.
/// The tone mapper this session would use without leaving the device.
///
/// Two things have to hold: the backend has one at all, and this build was
/// compiled with it. Neither implies the other — QSV has no tone mapper of its
/// own whatever the build, and a package without `tonemap_vaapi` leaves a card
/// that would otherwise manage it perfectly well.
#[must_use]
pub fn on_device_tone_map_filter(
    spec: &SessionSpec,
    filters: DeviceFilters,
) -> Option<&'static str> {
    if !filters.tone_map {
        return None;
    }

    spec.hardware_accel.pipeline()?.tone_map
}

/// Whether HDR can be converted without the frames coming down.
#[must_use]
fn on_device_tone_map(spec: &SessionSpec, filters: DeviceFilters) -> bool {
    on_device_tone_map_filter(spec, filters).is_some()
}

/// The chain that brings frames to the size and colour they leave in.
///
/// Tone mapping precedes the scale for the same reason it does in software:
/// converting the already-resampled picture loses highlight detail. On the
/// device the full-size conversion costs a fraction of what it does in system
/// memory, so the order stays and the price does not.
#[must_use]
fn device_chain(
    pipeline: HardwarePipeline,
    tone_map: Option<&'static str>,
    width: u32,
    height: u32,
) -> String {
    let scale = format!("{}=w={width}:h={height}", pipeline.scaler);

    match tone_map {
        Some(mapper) => format!("{mapper},{scale}"),
        None => scale,
    }
}

#[must_use]
pub fn frame_route(spec: &SessionSpec, filters: DeviceFilters) -> FrameRoute {
    if !filters.scaler || spec.hardware_accel.pipeline().is_none() {
        return FrameRoute::InSoftware;
    }

    let VideoAction::Encode { tone_map, .. } = &spec.video else {
        return FrameRoute::InSoftware;
    };

    if spec.source_size.is_none() {
        return FrameRoute::InSoftware;
    }

    if tone_map.is_some() && !on_device_tone_map(spec, filters) {
        return FrameRoute::InSoftware;
    }

    match spec.subtitles {
        SubtitleAction::None => FrameRoute::OnDevice,
        SubtitleAction::BurnIn { .. } if filters.overlay => FrameRoute::Composited,
        SubtitleAction::BurnIn {
            is_image_based: false,
            ..
        } => FrameRoute::DownAndBack,
        SubtitleAction::BurnIn {
            is_image_based: true,
            ..
        } => FrameRoute::InSoftware,
    }
}

/// Whether this session can run without ever bringing frames back.
///
/// The narrow question, kept because it is the one worth asking about a plain
/// rescale: `DownAndBack` is faster than software and slower than never
/// leaving at all.
#[must_use]
pub fn keeps_frames_on_the_gpu(spec: &SessionSpec, filters: DeviceFilters) -> bool {
    matches!(frame_route(spec, filters), FrameRoute::OnDevice)
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
    /// What a frame becomes on its way down to system memory.
    ///
    /// Named rather than left to ffmpeg. Asked to negotiate one it picks
    /// `gray`, which `hwdownload` then refuses — the download has to be told a
    /// format the frames context actually holds, and that is a property of the
    /// backend. Measured: a Vulkan context rejects `nv12` and wants `yuv420p`,
    /// where every backend here is the other way round.
    pub download_format: &'static str,
    /// The compositor that draws a second picture onto this backend's frames.
    ///
    /// Burning subtitles in does not have to bring the video down. The overlay
    /// is built as its own small stream, uploaded, and drawn on the device,
    /// which is what these filters are for. Only `overlay_videotoolbox` is not
    /// upstream — it comes from a patch flux-ffmpeg carries, so a stock build
    /// will not have it and the probe will say so.
    pub overlay: &'static str,
    /// The pixel format the overlay has to be in before it is uploaded.
    ///
    /// Not the same everywhere: `overlay_cuda` composites in `yuva420p` and
    /// the rest take straight `bgra`. Handing a filter the other one is a
    /// filtergraph that will not configure.
    pub overlay_format: &'static str,
    /// How the overlay gets onto the device.
    ///
    /// A bare `hwupload` only works where a frames context is already in hand,
    /// as it is after a `hwdownload` in the same chain. The overlay starts on
    /// its own branch from a software source, so it has to name the device to
    /// derive from.
    pub overlay_upload: &'static str,
    /// The filter that converts HDR to SDR on this backend's own frames.
    ///
    /// `None` where the backend has no tone mapper of its own. QSV and RKMPP
    /// are in that position: both would have to derive a second `OpenCL` or
    /// Vulkan device, which is a different piece of work, and until it is done
    /// they convert in software exactly as before.
    ///
    /// The whole expression rather than the name, because the three that exist
    /// do not take the same options: `tonemap_vaapi` is fixed-function VPP with
    /// no algorithm to choose, `tonemap_cuda` has one but — unlike every other
    /// `tonemap_*` — no `desat`, and `tonemap_videotoolbox` adds `tonemap_mode`
    /// and `apply_dovi` that neither of the others offers.
    ///
    /// `VideoToolbox`'s options are read out of the macOS package FLUX-110
    /// built, and the expression below was run against it on Apple silicon
    /// rather than inferred from the patch.
    pub tone_map: Option<&'static str>,
}

impl HardwareAccel {
    /// The pipeline this backend can run end to end, if it can run one.
    ///
    /// `Amf` has none: its `-hwaccel` here is `d3d11va`, which is Windows only,
    /// and AMD on Linux goes through `VAAPI` instead — as ADR-0010 says, AMF
    /// there wants the closed `amdgpu-pro` driver. It keeps working exactly as
    /// before, on the software filter chain.
    ///
    /// `Rkmpp` decodes to `drm_prime` and scales with `scale_rkrga`, the RGA 2D
    /// block that `--enable-rkrga` is in the build for. **No Rockchip board has
    /// ever run this.** It is here because the alternative was worse: Flux ships
    /// the RKMPP encoders, so withholding the pipeline left that hardware with a
    /// hardware encoder fed by a full round trip through system memory — the
    /// most expensive arrangement available, and the exact defect this pipeline
    /// work exists to remove.
    ///
    /// The three values are read out of the shipped arm64 package rather than
    /// guessed, and a wrong one fails loudly: the transcode aborts, software
    /// takes over, and the rejection is reported. See FLUX-103.
    #[must_use]
    pub fn pipeline(self) -> Option<HardwarePipeline> {
        match self {
            Self::VideoToolbox => Some(HardwarePipeline {
                output_format: "videotoolbox_vld",
                scaler: "scale_vt",
                download_format: "nv12",
                overlay: "overlay_videotoolbox",
                overlay_format: "bgra",
                overlay_upload: "hwupload",
                tone_map: Some(
                    "tonemap_videotoolbox=format=nv12:p=bt709:t=bt709:m=bt709:tonemap=bt2390",
                ),
            }),
            Self::Nvenc => Some(HardwarePipeline {
                output_format: "cuda",
                scaler: "scale_cuda",
                download_format: "nv12",
                overlay: "overlay_cuda",
                overlay_format: "yuva420p",
                overlay_upload: "hwupload=derive_device=cuda",
                tone_map: Some(
                    "tonemap_cuda=format=yuv420p:p=bt709:t=bt709:m=bt709:tonemap=bt2390",
                ),
            }),
            Self::Qsv => Some(HardwarePipeline {
                output_format: "qsv",
                scaler: "vpp_qsv",
                download_format: "nv12",
                overlay: "overlay_qsv",
                overlay_format: "bgra",
                overlay_upload: "hwupload=derive_device=qsv:extra_hw_frames=64",
                tone_map: None,
            }),
            Self::Vaapi => Some(HardwarePipeline {
                output_format: "vaapi",
                scaler: "scale_vaapi",
                download_format: "nv12",
                overlay: "overlay_vaapi",
                overlay_format: "bgra",
                overlay_upload: "hwupload=derive_device=vaapi",
                tone_map: Some("tonemap_vaapi=format=nv12:p=bt709:t=bt709:m=bt709"),
            }),
            Self::Rkmpp => Some(HardwarePipeline {
                output_format: "drm_prime",
                scaler: "scale_rkrga",
                download_format: "nv12",
                overlay: "overlay_rkrga",
                overlay_format: "bgra",
                overlay_upload: "hwupload=derive_device=rkmpp",
                tone_map: None,
            }),
            Self::None | Self::Amf => None,
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

    /// The device arguments a filter graph needs when its frames start in
    /// software.
    ///
    /// Not the same question as [`Self::device_arguments`], and the two backends
    /// that find their own device are where they part company. `NVENC` and
    /// `VideoToolbox` both take theirs from the decoder, which every real
    /// session has — so a transcode needs nothing, and naming a second device
    /// there would risk `hwupload` filling a pool the decoder does not share.
    ///
    /// A probe has no decoder. Its frames come from `lavfi`, and `hwupload`
    /// with nothing to derive from fails with "a hardware device reference is
    /// required to upload frames to". So the probe asks for a device that a
    /// transcode must not.
    ///
    /// Measured on both, rather than reasoned from one. `VideoToolbox` on Apple
    /// silicon and `tonemap_cuda` on an RTX 5080 fail identically without this,
    /// which means `tonemap_cuda` had never once verified: FLUX-111 shipped the
    /// filter and every HDR session on `NVENC` converted in software anyway,
    /// looking exactly like a card that could not do it.
    #[must_use]
    pub fn filter_device_arguments(self, device: &str) -> Vec<String> {
        match self {
            Self::VideoToolbox => vec![
                "-init_hw_device".to_owned(),
                "videotoolbox=vt".to_owned(),
                "-filter_hw_device".to_owned(),
                "vt".to_owned(),
            ],
            Self::Nvenc => vec![
                "-init_hw_device".to_owned(),
                "cuda=cu".to_owned(),
                "-filter_hw_device".to_owned(),
                "cu".to_owned(),
            ],
            _ => self.device_arguments(device),
        }
    }
}

/// How hard each encoder family is asked to work, on its own scale.
///
/// There is no shared unit here and the scales do not even point the same way. x264 and x265 count
/// CRF from 0 to 51 where lower is better; SVT-AV1 goes to 63 and needs a higher number for the
/// same picture; `VideoToolbox` runs 1 to 100 with **higher** being better, which is the trap in
/// this table. A value copied from one family into another is not merely mistuned, it is a
/// different request entirely, and the two directions mean a mistake reads as either mush or a file
/// several times the size it should be.
///
/// Measured against this build rather than taken from documentation. Each pairing below was run.
const QUALITY_TARGETS: [(&str, &str, &str); 10] = [
    ("libx264", "-crf", "21"),
    ("libx265", "-crf", "24"),
    ("libsvtav1", "-crf", "32"),
    ("libvpx-vp9", "-crf", "32"),
    ("h264_videotoolbox", "-q:v", "62"),
    ("hevc_videotoolbox", "-q:v", "62"),
    ("h264_nvenc", "-cq", "23"),
    ("hevc_nvenc", "-cq", "25"),
    ("av1_nvenc", "-cq", "29"),
    ("libvpx", "-crf", "32"),
];

/// Encoders that will not open on a quality target without a bitrate to anchor it to.
const NEEDS_A_BITRATE_TOO: [&str; 2] = ["libvpx-vp9", "libvpx"];

/// How much the encoder may overshoot the cap before it has to give the bits back.
const BUFFER_MULTIPLE: u32 = 2;

/// How to ask an encoder for a picture, rather than for a number of bits.
///
/// A bitrate is not a quality. Told to hit four and a half megabits, an encoder spends all of them
/// whatever it is given: an animated film that would have been transparent at half the bits gets
/// them anyway, and a grainy one that needed more is held to the same figure and smears. What the
/// content actually costs varies by more than the ladder ever could.
///
/// So the bitrate becomes a **ceiling** rather than a target, and the encoder is given a quality to
/// hold instead. It spends what the picture needs and stops. The file size stops being dictated and
/// becomes a consequence, which is also what FLUX-21 wants for download estimates: `maxrate` times
/// duration is an upper bound, and the real file usually comes in under it.
///
/// `bufsize` is what makes the ceiling mean anything. It is the window the cap is measured over —
/// without it an encoder may satisfy `maxrate` on average while sending a burst no connection can
/// carry through the scene that mattered.
///
/// An encoder with no quality scale here keeps the bitrate it always had, now capped rather than
/// merely aimed at. That is strictly better than before and asks nothing of a backend nobody has
/// put a file through: AMF, RKMPP, QSV and VAAPI each express quality differently enough that
/// guessing would be worse than the honest bitrate they already get.
///
#[must_use]
pub fn rate_control_arguments(encoder: &str, max_bitrate_kbps: u32) -> Vec<String> {
    let target = QUALITY_TARGETS.iter().find(|(name, _, _)| *name == encoder);

    let mut arguments = Vec::new();

    if let Some((_, flag, value)) = target {
        arguments.push((*flag).to_owned());
        arguments.push((*value).to_owned());
    }

    if target.is_none() || NEEDS_A_BITRATE_TOO.contains(&encoder) {
        arguments.push("-b:v".to_owned());
        arguments.push(format!("{max_bitrate_kbps}k"));
    }

    arguments.push("-maxrate".to_owned());
    arguments.push(format!("{max_bitrate_kbps}k"));
    arguments.push("-bufsize".to_owned());
    arguments.push(format!("{}k", max_bitrate_kbps * BUFFER_MULTIPLE));

    arguments
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

/// Tells the encoder to put a keyframe where every segment has to begin.
///
/// `-hls_time` is a request, not an instruction. The muxer can only start a
/// segment on a keyframe, so asking for four seconds from a source with a ten
/// second GOP produces ten second segments and no complaint at all. Measured on
/// a realistic encode — B-frames, ten second GOP — Flux asked for four and got
/// six segments of exactly ten. Forcing them gives fifteen of exactly four, and
/// drops the first segment from 9.5 MB to 3.7 MB.
///
/// That first segment is what a viewer waits for before anything appears, and
/// what has to be fetched again after every seek, because a seek starts a new
/// session and a new session encodes from nothing. Segments larger than asked
/// for make every one of those waits longer and lumpier.
///
/// A run that starts part way in keeps the film's own clock, so the expression
/// has to start from where the run does. Counting from nought against an
/// absolute clock is satisfied by every frame until the count catches up:
/// measured on a run seeking to 1070 seconds, that is a forced keyframe on
/// each of the next few hundred frames, which is a picture nobody asked for
/// and segments nothing predicted.
///
/// Only meaningful where Flux is encoding. A copied stream keeps the keyframes
/// it already has and there is no encoder to instruct.
#[must_use]
fn force_key_frames_argument(segment_seconds: u32, from_seconds: f64) -> String {
    if from_seconds <= 0.0 {
        return format!("expr:gte(t,n_forced*{segment_seconds})");
    }

    format!("expr:gte(t,{from_seconds:.6}+n_forced*{segment_seconds})")
}

/// Where a run begins.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct SegmentStart {
    /// The segment's index, which its files are numbered from.
    pub index: u32,
    /// Where to seek to, which is inside that segment rather than at its edge.
    ///
    /// A seek lands on the last keyframe whose *decode* time is at or before
    /// the time asked for, and a keyframe is decoded before it is shown — by
    /// 0.376 seconds on the film this was measured against. Asking for the
    /// exact boundary therefore lands on the keyframe before it, and a run
    /// that starts a segment early writes every segment one place out for as
    /// long as it lasts.
    ///
    /// Asking from inside the segment cannot overshoot, because the next
    /// keyframe is its far edge. Measured: `-ss 2394.1` started at 2383.673
    /// and `-ss 2394.6` started at 2394.100, exactly where the playlist says
    /// segment 596 begins.
    pub seconds: f64,
}

/// A fully resolved transcode instruction.
///
/// The `FFmpeg` command line is always built from this struct and never
/// assembled from strings at call sites, so that invocations are
/// deterministic, unit testable without spawning a process, and loggable in
/// full for support. See ADR-0009.
#[derive(Debug, Clone, PartialEq)]
pub struct TranscodePlan {
    pub spec: SessionSpec,
    pub output_directory: String,
    /// The render node VAAPI and QSV are opened on.
    ///
    /// A property of the host rather than of the output, so it is deliberately
    /// not part of the session key: pointing Flux at a different card should
    /// not orphan every segment already on disk.
    pub device: String,
    /// Which of the filters this backend needs the build actually has.
    ///
    /// Asked rather than assumed. `scale_vt` arrived in `FFmpeg` 7.0 and some
    /// builds ship `scale_npp` in place of `scale_cuda`, so the filter is a
    /// property of the binary. Assuming it exists produces a chain that fails
    /// and falls back to software, which costs most of the saving and says
    /// nothing about why.
    pub device_filters: DeviceFilters,
    /// Which segment this run starts at, and where that segment begins.
    ///
    /// A run walks forward from here until it is stopped, so a viewer seeking
    /// far ahead gets a new run rather than a wait for the old one to arrive.
    /// The number matters as much as the time: `-start_number` makes the files
    /// a run writes carry their place in the film, so the playlist can name
    /// them before any run has produced them and a later run picks up where an
    /// earlier one was stopped.
    ///
    /// Nought for a film played from the beginning, which is the common case.
    pub start_at: SegmentStart,
    /// What to ask the muxer to cut at, in seconds.
    ///
    /// Not the same as the segment length asked for, and deliberately so. The
    /// muxer can only cut on a keyframe, and its target advances by this much
    /// per cut whether or not a cut lands where the target was — so on a copied
    /// stream, asking for less than the closest pair of keyframes is what makes
    /// every run cut in the same places wherever it started. Where Flux encodes
    /// it puts the keyframes itself and this is simply the length wanted.
    ///
    /// See [`crate::keyframes::cut_interval`].
    pub cut_seconds: f64,
}

/// The manifest file every session writes.
pub const MANIFEST_NAME: &str = "index.m3u8";

/// The playlist ffmpeg writes as it goes.
///
/// Deliberately not [`MANIFEST_NAME`]. The playlist Flux serves describes the
/// whole film and is written before any of it is transcoded; ffmpeg's own
/// grows as segments appear and would overwrite it on every run. Only the
/// segments the run writes are wanted from it — the head of the transcode is
/// read from the directory instead.
pub const RUN_PLAYLIST_NAME: &str = "run.m3u8";

impl TranscodePlan {
    /// Adds the video arguments, saying whether they mapped the streams.
    ///
    /// Compositing bitmap subtitles has to name its own inputs and output, so
    /// that branch maps the streams itself; every other route leaves it to the
    /// caller. Handing that fact back rather than working it out a second time
    /// downstream is what stops the two disagreeing and mapping the source
    /// video alongside the composited one.
    /// Where this run's encoder must put its keyframes.
    fn forced_keyframes(&self) -> String {
        force_key_frames_argument(self.spec.segment_seconds, self.start_at.seconds)
    }

    /// What a copied video stream has to be marked as, where it has to be
    /// marked at all.
    ///
    /// Only HEVC, and only in fragmented MP4. `hvc1` says the parameter sets
    /// live in the configuration record, which is what a player reads before it
    /// decodes anything; `hev1` allows them in the stream instead, and is what
    /// `FFmpeg` writes for HEVC in MP4 unless it is told otherwise. Safari
    /// refuses `hev1` outright and Chromium decodes nothing from it, so a
    /// perfectly good copy arrives as sound over a black picture.
    ///
    /// Transport streams carry no codec tag at all, so there is nothing to say.
    fn copied_video_tag(&self) -> Option<&'static str> {
        if !self.spec.container.needs_init_segment() {
            return None;
        }

        match self.spec.source_video_codec.as_deref() {
            Some("hevc") => Some("hvc1"),
            _ => None,
        }
    }

    fn push_video_args(&self, args: &mut Vec<String>) -> bool {
        let mut is_mapped = false;

        match &self.spec.video {
            VideoAction::Copy => {
                args.push("-c:v".into());
                args.push("copy".into());

                if let Some(tag) = self.copied_video_tag() {
                    args.push("-tag:v".into());
                    args.push(tag.into());
                }
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
                args.extend(rate_control_arguments(encoder, *max_bitrate_kbps));
                args.extend(
                    NO_EMBEDDED_CAPTIONS
                        .iter()
                        .map(|argument| (*argument).to_owned()),
                );
                args.push("-force_key_frames".into());
                args.push(self.forced_keyframes());

                let route = frame_route(&self.spec, self.device_filters);

                if let (Some(pipeline), Some(source)) =
                    (self.spec.hardware_accel.pipeline(), self.spec.source_size)
                {
                    let (width, height) = fitted_size(source, *max_width, *max_height);

                    let scale = device_chain(
                        pipeline,
                        tone_map.and(on_device_tone_map_filter(&self.spec, self.device_filters)),
                        width,
                        height,
                    );

                    match route {
                        FrameRoute::OnDevice => {
                            args.push("-vf".into());
                            args.push(scale);

                            return is_mapped;
                        }
                        FrameRoute::DownAndBack => {
                            if let SubtitleAction::BurnIn { subtitle_index, .. } =
                                &self.spec.subtitles
                            {
                                args.push("-vf".into());
                                args.push(format!(
                                    "{scale},hwdownload,format={},subtitles='{}':si={subtitle_index},hwupload",
                                    pipeline.download_format,
                                    escape_filter_path(&self.spec.input_path),
                                ));

                                return is_mapped;
                            }
                        }
                        FrameRoute::Composited => {
                            if let Some(graph) = composited_graph(
                                &scale,
                                pipeline,
                                &self.spec.subtitles,
                                &self.spec.input_path,
                                width,
                                height,
                            ) {
                                args.push("-filter_complex".into());
                                args.push(graph);
                                self.push_graph_maps(args);

                                return true;
                            }
                        }
                        FrameRoute::InSoftware => {}
                    }
                }

                let chain =
                    video_filter_chain(*max_width, *max_height, *tone_map, self.text_burn_in());

                if let SubtitleAction::BurnIn {
                    subtitle_index,
                    is_image_based: true,
                } = &self.spec.subtitles
                {
                    args.push("-filter_complex".into());
                    args.push(self.software_composited_graph(
                        &chain,
                        *subtitle_index,
                        *max_width,
                        *max_height,
                    ));
                    self.push_graph_maps(args);

                    is_mapped = true;
                } else {
                    args.push("-vf".into());
                    args.push(chain);
                }
            }
        }

        is_mapped
    }

    /// The subtitle the software chain renders itself, if there is one.
    ///
    /// Only text: the `subtitles` filter draws from the file, and a bitmap
    /// subtitle is a second stream that a linear chain cannot reach.
    fn text_burn_in(&self) -> Option<(&str, u32)> {
        match &self.spec.subtitles {
            SubtitleAction::BurnIn {
                subtitle_index,
                is_image_based: false,
            } => Some((self.spec.input_path.as_str(), *subtitle_index)),
            _ => None,
        }
    }

    /// Draws a bitmap subtitle on in system memory.
    ///
    /// The route every build without the backend's compositor takes, which is
    /// every stock one — and the route 18.6% of the reference library needs,
    /// since a bitmap subtitle cannot be turned into text and so cannot be sent
    /// for the client to draw.
    ///
    /// The size is worked out here rather than left to an expression because
    /// the subtitle has to be brought to the same size as the picture, and
    /// `pad` needs a number. `scale_filter` fits the picture inside the box
    /// without exceeding the source, which is exactly what `fitted_size`
    /// computes, so the two agree. A spec carrying no source size is not a case
    /// the server produces — it always sends the item's own dimensions — so the
    /// box is a floor rather than a guess.
    fn software_composited_graph(
        &self,
        chain: &str,
        subtitle_index: u32,
        max_width: u32,
        max_height: u32,
    ) -> String {
        let (width, height) = self
            .spec
            .source_size
            .map_or((max_width, max_height), |source| {
                fitted_size(source, max_width, max_height)
            });

        format!(
            "[0:v]{chain}[base];{}[sub];\
             [base][sub]overlay=eof_action=pass:repeatlast=0[v]",
            bitmap_subtitle_branch(subtitle_index, width, height)
        )
    }

    /// Names the streams a filter graph produces.
    ///
    /// A graph labels its output, and once anything is mapped explicitly
    /// `FFmpeg` stops choosing streams by itself — so the audio has to be named
    /// here too or it is dropped. `0:a?` rather than `0:a` because a file with
    /// no audio should still transcode rather than fail to start.
    fn push_graph_maps(&self, args: &mut Vec<String>) {
        args.push("-map".into());
        args.push("[v]".into());
        args.push("-map".into());
        args.push(match self.spec.audio_stream_index {
            Some(index) => format!("0:{index}"),
            None => "0:a?".into(),
        });
    }

    /// How the audio is treated, which is the same wherever it is asked for.
    fn push_audio_args(&self, args: &mut Vec<String>) {
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

        let on_the_gpu = frame_route(&self.spec, self.device_filters).decodes_on_the_device();

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

        if self.start_at.seconds > 0.0 {
            args.push("-ss".into());
            args.push(format!("{:.6}", self.start_at.seconds));
        }

        args.push("-copyts".into());

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

        self.push_audio_args(&mut args);

        args.push("-avoid_negative_ts".into());
        args.push("disabled".into());
        args.push("-f".into());
        args.push("hls".into());
        args.push("-muxdelay".into());
        args.push("0".into());
        args.push("-muxpreload".into());
        args.push("0".into());
        args.push("-hls_time".into());
        args.push(format!("{:.6}", self.cut_seconds));
        args.push("-hls_playlist_type".into());
        args.push("event".into());
        args.push("-hls_list_size".into());
        args.push("0".into());
        args.push("-start_number".into());
        args.push(self.start_at.index.to_string());

        if self.spec.container.needs_init_segment() {
            args.push("-hls_segment_options".into());
            args.push("movflags=+frag_discont+skip_sidx+negative_cts_offsets".into());
            args.push("-hls_segment_type".into());
            args.push("fmp4".into());
            args.push("-hls_fmp4_init_filename".into());
            args.push(INIT_SEGMENT_NAME.into());
        }

        args.push("-hls_segment_filename".into());
        args.push(format!(
            "{}/segment%05d.{}",
            self.output_directory,
            self.spec.container.extension()
        ));
        args.push(format!("{}/{RUN_PLAYLIST_NAME}", self.output_directory));

        args
    }
}

#[cfg(test)]
mod tests {
    use super::{
        composited_graph, filter_name, fitted_size, force_key_frames_argument, frame_route,
        keeps_frames_on_the_gpu, rate_control_arguments, software_equivalent, AudioAction,
        DeviceFilters, FrameRoute, HardwareAccel, SegmentContainer, SegmentStart, SessionSpec,
        SubtitleAction, ToneMapping, TranscodePlan, VideoAction, DEFAULT_DEVICE, TEXT_OVERLAY_FPS,
    };

    /// A build with a scaler and no compositor, as the existing routes assume.
    const SCALER_ONLY: DeviceFilters = DeviceFilters {
        scaler: true,
        overlay: false,
        tone_map: false,
    };

    /// A build with both, as the shipped package has.
    const FULL: DeviceFilters = DeviceFilters {
        scaler: true,
        overlay: true,
        tone_map: true,
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
            container: SegmentContainer::Fmp4,
            source_video_codec: None,
        }
    }

    fn copying(codec: &str, container: SegmentContainer) -> SessionSpec {
        SessionSpec {
            video: VideoAction::Copy,
            container,
            source_video_codec: Some(codec.to_owned()),
            ..spec()
        }
    }

    /// `FFmpeg` writes `hev1` for HEVC in MP4 unless it is told otherwise, and
    /// a player given `hev1` shows a black picture and plays the sound.
    #[test]
    fn marks_a_copied_hevc_stream_as_hvc1_in_fragmented_mp4() {
        let args = plan(copying("hevc", SegmentContainer::Fmp4)).to_ffmpeg_args();

        assert!(args.windows(2).any(|pair| pair == ["-tag:v", "hvc1"]));
    }

    /// A transport stream carries no codec tag, so there is nothing to say.
    #[test]
    fn marks_nothing_when_the_segments_are_transport_streams() {
        let args = plan(copying("hevc", SegmentContainer::MpegTs)).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument == "-tag:v"));
    }

    /// H.264 has one marking in MP4 and `FFmpeg` already writes it.
    #[test]
    fn leaves_the_tag_alone_for_a_codec_with_only_one() {
        let args = plan(copying("h264", SegmentContainer::Fmp4)).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument == "-tag:v"));
    }

    /// An encode writes whatever the encoder produces, which is not the source.
    #[test]
    fn leaves_the_tag_alone_when_encoding() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_videotoolbox".into(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
                tone_map: None,
            },
            source_video_codec: Some("hevc".into()),
            ..spec()
        };

        assert!(!plan(spec).to_ffmpeg_args().iter().any(|a| a == "-tag:v"));
    }

    /// `-hls_time` is a request the muxer can only honour on a keyframe.
    ///
    /// Measured before this: a four second request against a ten second GOP
    /// produced ten second segments and said nothing. The two numbers have to
    /// be the same one, so this reads both out of the emitted arguments rather
    /// than asserting the expression in isolation.
    /// A run that seeks counts from where it starts, not from nought.
    ///
    /// With the film's own clock the counting form is satisfied by every frame
    /// until it catches up, so a run starting at 1070 seconds forces a
    /// keyframe on hundreds of consecutive frames.
    #[test]
    fn counts_forced_keyframes_from_where_the_run_starts() {
        let mut session = plan(on_gpu(HardwareAccel::Vaapi));
        session.start_at = SegmentStart {
            index: 267,
            seconds: 1070.0,
        };

        let args = session.to_ffmpeg_args();

        assert!(args
            .windows(2)
            .any(|pair| pair == ["-force_key_frames", "expr:gte(t,1070.000000+n_forced*4)"]));
    }

    #[test]
    fn cuts_keyframes_where_segments_are_asked_to_begin() {
        let args = plan(on_gpu(HardwareAccel::Vaapi)).to_ffmpeg_args();

        let forced = args
            .windows(2)
            .find(|pair| pair[0] == "-force_key_frames")
            .map(|pair| pair[1].clone())
            .expect("keyframes are forced");

        let segment: f64 = args
            .windows(2)
            .find(|pair| pair[0] == "-hls_time")
            .and_then(|pair| pair[1].parse().ok())
            .expect("a segment length");

        assert_eq!(forced, format!("expr:gte(t,n_forced*{})", segment.round()));
    }

    #[test]
    fn builds_the_expression_from_the_segment_length() {
        assert_eq!(force_key_frames_argument(4, 0.0), "expr:gte(t,n_forced*4)");
        assert_eq!(force_key_frames_argument(6, 0.0), "expr:gte(t,n_forced*6)");
    }

    /// A copied stream keeps the keyframes it already has.
    ///
    /// There is no encoder to instruct, and asking anyway is an argument
    /// ffmpeg has nothing to apply it to.
    #[test]
    fn does_not_ask_a_copied_stream_for_keyframes() {
        let spec = SessionSpec {
            video: VideoAction::Copy,
            ..spec()
        };

        let args = plan(spec).to_ffmpeg_args();

        assert!(
            !args.iter().any(|argument| argument == "-force_key_frames"),
            "{args:?}"
        );
    }

    /// Where a viewer joined is the one thing a plan does not care about.
    #[test]
    fn gives_two_viewers_of_the_same_film_the_same_plan() {
        let beginning = spec();
        let later = SessionSpec {
            start_seconds: 2400,
            ..spec()
        };

        assert_eq!(beginning.plan_id(), later.plan_id());
        assert_ne!(
            beginning.session_id(),
            later.session_id(),
            "the session is still where playback began, which is what the plan is not"
        );
    }

    /// Everything that changes the bytes still changes the plan.
    #[test]
    fn gives_a_different_treatment_a_different_plan() {
        let plain = spec();

        let rescaled = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264".to_owned(),
                max_bitrate_kbps: 4000,
                max_width: 640,
                max_height: 360,
                tone_map: None,
            },
            ..spec()
        };
        let resegmented = SessionSpec {
            segment_seconds: 6,
            ..spec()
        };
        let other_audio = SessionSpec {
            audio_stream_index: Some(3),
            ..spec()
        };

        assert_ne!(plain.plan_id(), rescaled.plan_id());
        assert_ne!(plain.plan_id(), resegmented.plan_id());
        assert_ne!(plain.plan_id(), other_audio.plan_id());
    }

    /// A run started part way in still writes the film's own numbering.
    ///
    /// Without this the files a run writes are numbered from nought whatever
    /// their place in the film, so a playlist naming segment three hundred is
    /// never satisfied and a later run overwrites an earlier one's work.
    #[test]
    fn numbers_a_run_from_the_segment_it_starts_at() {
        let mut session = plan(on_gpu(HardwareAccel::Vaapi));
        session.start_at = SegmentStart {
            index: 300,
            seconds: 2306.4,
        };

        let args = session.to_ffmpeg_args();

        assert!(args.windows(2).any(|pair| pair == ["-start_number", "300"]));
        assert!(args.windows(2).any(|pair| pair == ["-ss", "2306.400000"]));
    }

    /// A run that starts part way in still writes the film's own clock.
    ///
    /// Without this its fragments are stamped from nought, so a player that
    /// seeked to forty minutes is handed something claiming to be the opening
    /// second and has nowhere to put it. Measured on the Bluray remux: the
    /// first fragment of a run seeking to 2394.1 carried 0.083 without
    /// `-copyts` and 2394.100 with it.
    #[test]
    fn keeps_the_films_own_timestamps_when_a_run_starts_part_way_in() {
        let mut session = plan(spec());
        session.start_at = SegmentStart {
            index: 300,
            seconds: 2306.4,
        };

        let args = session.to_ffmpeg_args();
        let seek = args.iter().position(|argument| argument == "-ss");
        let copy = args.iter().position(|argument| argument == "-copyts");
        let input = args.iter().position(|argument| argument == "-i");

        assert!(copy.is_some(), "expected -copyts");
        assert!(
            seek < copy && copy < input,
            "expected -ss -copyts before -i"
        );
    }

    /// A run from the beginning has the film's own clock to preserve too.
    ///
    /// This test used to assert the opposite, on the reasoning that a run
    /// starting at nought has nothing to keep. It has: an audio encoder's first
    /// frame carries a priming delay that puts it before the video, and ffmpeg's
    /// default answer is to shift the whole film forward so nothing is negative.
    /// Measured on a real remux — the playlist, built from the source's own
    /// keyframes, says the second segment begins at 3.458; the media ffmpeg
    /// wrote began it at 3.626. Every boundary in the film was 167ms out of step
    /// with the playlist describing it.
    #[test]
    fn keeps_the_films_own_timestamps_from_the_beginning_as_well() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.iter().any(|argument| argument == "-copyts"));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-avoid_negative_ts", "disabled"]));
    }

    /// The muxer must not shift what the playlist has already described.
    ///
    /// `-copyts` alone is not enough: it keeps the timestamps and the muxer
    /// shifts them anyway. Both were measured together, and only together did
    /// the media land on the keyframes the playlist names.
    #[test]
    fn refuses_the_muxers_offer_to_move_the_film_off_its_own_clock() {
        let mut sought = plan(spec());
        sought.start_at = SegmentStart {
            index: 300,
            seconds: 2306.4,
        };

        for session in [plan(spec()), sought] {
            let args = session.to_ffmpeg_args();

            assert!(
                args.windows(2)
                    .any(|pair| pair == ["-avoid_negative_ts", "disabled"]),
                "expected the shift to be refused"
            );
        }
    }

    /// Fragmented MP4 needs the initial delay written into its fragments, and
    /// no index box written over the boundaries.
    ///
    /// Without `frag_discont` the delay never reaches `moof/traf/tfdt`, so the
    /// audio of every fragment is stamped a frame away from where it belongs.
    /// Without `skip_sidx` ffmpeg writes an index HLS never reads, and rewrites
    /// the presentation times of open-GOP boundary packets to build it.
    ///
    /// Without `negative_cts_offsets` a fragment cannot say a sample is
    /// presented after it is decoded, so the muxer stamps the fragment with the
    /// first presentation time instead of the first decode time. Every fragment
    /// then declares a decode clock one reorder window late — measured at 167ms
    /// on a film whose frames are reordered four deep — and at a join the frames
    /// inside that window have nowhere consistent to sit. A viewer sees the
    /// picture skip while the sound plays on: 17.292s to 17.458s in one
    /// measurement, which is that window exactly.
    #[test]
    fn tells_the_fragmented_muxer_what_a_player_needs_and_nothing_it_does_not() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.windows(2).any(|pair| pair
            == [
                "-hls_segment_options",
                "movflags=+frag_discont+skip_sidx+negative_cts_offsets"
            ]));
    }

    /// Transport streams carry none of that and must not be told to.
    #[test]
    fn leaves_a_transport_stream_run_without_fragment_options() {
        let mut session = plan(spec());
        session.spec.container = SegmentContainer::MpegTs;

        assert!(!session
            .to_ffmpeg_args()
            .iter()
            .any(|argument| argument == "-hls_segment_options"));
    }

    /// A film played from the beginning seeks to nothing.
    #[test]
    fn does_not_seek_a_run_that_starts_at_the_beginning() {
        let args = plan(on_gpu(HardwareAccel::Vaapi)).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument == "-ss"));
        assert!(args.windows(2).any(|pair| pair == ["-start_number", "0"]));
    }

    fn keeps_frames_on_the_gpu_of(spec: &SessionSpec) -> bool {
        keeps_frames_on_the_gpu(spec, SCALER_ONLY)
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

    /// A burned-in subtitle used to send the whole session into software.
    ///
    /// It now goes down for the one filter that needs system memory and comes
    /// straight back, so the decode and the scale stay where they were.
    #[test]
    fn comes_down_only_for_the_subtitle_and_goes_straight_back() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 2,
                is_image_based: false,
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert_eq!(
            frame_route(&spec, SCALER_ONLY),
            FrameRoute::DownAndBack,
            "a text burn in is the one software filter that fits a linear chain"
        );

        let args = plan(spec).to_ffmpeg_args();
        let chain = args
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert_eq!(
            chain,
            "scale_vt=w=1280:h=532,hwdownload,format=nv12,\
subtitles='/media/film.mkv':si=2,hwupload"
        );

        assert!(
            args.windows(2)
                .any(|pair| pair == ["-hwaccel_output_format", "videotoolbox_vld"]),
            "it still decodes on the device — coming down is a choice made later"
        );
    }

    /// HDR used to cost the whole session, and now costs nothing extra.
    ///
    /// Tone mapping was the last thing that forced everything into software:
    /// the conversion has to precede the scale, so a round trip around it would
    /// drag the scale down too and leave nothing on the device worth having.
    #[test]
    fn converts_hdr_without_leaving_the_device() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_vaapi".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Zscale),
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        assert_eq!(frame_route(&spec, FULL), FrameRoute::OnDevice);

        let args = plan_compositing(spec).to_ffmpeg_args();
        let chain = args
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert_eq!(
            chain,
            "tonemap_vaapi=format=nv12:p=bt709:t=bt709:m=bt709,scale_vaapi=w=1280:h=532"
        );
        assert!(
            !chain.contains("zscale") && !chain.contains("hwdownload"),
            "neither the software conversion nor a round trip: {chain}"
        );
    }

    /// A Mac converts HDR on the device too, once the build has the filter.
    ///
    /// This was the one backend left in software after FLUX-111, because the
    /// filter is a flux-ffmpeg patch and there was no macOS package to check
    /// its options against. FLUX-110 built one, and the expression below was
    /// run against it on Apple silicon.
    #[test]
    fn converts_hdr_on_a_mac_without_leaving_the_device() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_videotoolbox".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Zscale),
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert_eq!(frame_route(&spec, FULL), FrameRoute::OnDevice);

        let args = plan_compositing(spec).to_ffmpeg_args();
        let chain = args
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        assert_eq!(
            chain,
            "tonemap_videotoolbox=format=nv12:p=bt709:t=bt709:m=bt709:tonemap=bt2390,\
             scale_vt=w=1280:h=532"
        );
    }

    /// The conversion precedes the scale, as it does in software.
    ///
    /// Tone mapping the already-resampled picture loses highlight detail. On
    /// the device the full-size conversion is cheap enough that the order costs
    /// nothing worth trading the detail for.
    #[test]
    fn converts_before_resampling_rather_than_after() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_nvenc".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Libplacebo),
            },
            ..on_gpu(HardwareAccel::Nvenc)
        };

        let args = plan_compositing(spec).to_ffmpeg_args();
        let chain = args
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        let mapper = chain.find("tonemap_cuda").expect("a tone mapper");
        let scale = chain.find("scale_cuda").expect("a scaler");

        assert!(mapper < scale, "convert then resample: {chain}");
    }

    /// `tonemap_cuda` has no `desat`, unlike every other `tonemap_*`.
    ///
    /// Jellyfin's shared format string appends one, and copying that verbatim
    /// produces a filter this build rejects. Checked against the shipped
    /// package rather than assumed from the family name.
    #[test]
    fn asks_each_tone_mapper_only_for_options_it_has() {
        let cuda = HardwareAccel::Nvenc
            .pipeline()
            .and_then(|pipeline| pipeline.tone_map)
            .expect("a tone mapper");

        assert!(!cuda.contains("desat"), "{cuda}");

        let vaapi = HardwareAccel::Vaapi
            .pipeline()
            .and_then(|pipeline| pipeline.tone_map)
            .expect("a tone mapper");

        assert!(
            !vaapi.contains("extra_hw_frames") && !vaapi.contains("tonemap="),
            "fixed-function VPP takes neither an algorithm nor a frame count: {vaapi}"
        );
    }

    /// A backend with no tone mapper of its own converts in software as before.
    ///
    /// QSV and RKMPP would both have to derive a second `OpenCL` or Vulkan
    /// device, which is its own piece of work. Until then this has to stay a
    /// deliberate fallback rather than a chain that will not run.
    #[test]
    fn converts_in_software_where_the_backend_has_no_tone_mapper() {
        for accel in [HardwareAccel::Qsv, HardwareAccel::Rkmpp] {
            let spec = SessionSpec {
                video: VideoAction::Encode {
                    encoder: "h264".to_owned(),
                    max_bitrate_kbps: 8000,
                    max_width: 1280,
                    max_height: 720,
                    tone_map: Some(ToneMapping::Zscale),
                },
                ..on_gpu(accel)
            };

            assert_eq!(
                frame_route(&spec, FULL),
                FrameRoute::InSoftware,
                "{accel:?} has no tone mapper of its own"
            );
        }
    }

    /// A build without the filter falls back even where the backend has one.
    #[test]
    fn converts_in_software_where_the_build_lacks_the_filter() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_vaapi".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Zscale),
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        assert_eq!(frame_route(&spec, SCALER_ONLY), FrameRoute::InSoftware);
    }

    /// Converting HDR and burning subtitles in at once still never comes down.
    #[test]
    fn converts_and_composites_in_the_same_graph() {
        let spec = SessionSpec {
            video: VideoAction::Encode {
                encoder: "h264_vaapi".to_owned(),
                max_bitrate_kbps: 8000,
                max_width: 1280,
                max_height: 720,
                tone_map: Some(ToneMapping::Zscale),
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 1,
                is_image_based: true,
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        assert_eq!(frame_route(&spec, FULL), FrameRoute::Composited);

        let args = plan_compositing(spec).to_ffmpeg_args();
        let graph = args
            .windows(2)
            .find(|pair| pair[0] == "-filter_complex")
            .map(|pair| pair[1].clone())
            .expect("a filter graph");

        assert!(
            graph.starts_with(
                "[0:v]tonemap_vaapi=format=nv12:p=bt709:t=bt709:m=bt709,\
scale_vaapi=w=1280:h=532[base];"
            ),
            "{graph}"
        );
        assert!(!graph.contains("hwdownload"), "{graph}");
    }

    /// A probe compares names; a chain carries options.
    #[test]
    fn reads_the_filter_name_out_of_its_expression() {
        assert_eq!(
            filter_name("tonemap_vaapi=format=nv12:p=bt709"),
            "tonemap_vaapi"
        );
        assert_eq!(filter_name("hwupload"), "hwupload");
    }

    /// The route that makes the descent unnecessary.
    ///
    /// Coming down for the subtitle was already better than running the whole
    /// session in software, but it still sends every frame across the bus. A
    /// build with the backend's compositor sends the subtitle the other way
    /// instead, and the film never moves.
    #[test]
    fn sends_the_subtitle_up_rather_than_the_film_down() {
        for is_image_based in [false, true] {
            let spec = SessionSpec {
                subtitles: SubtitleAction::BurnIn {
                    subtitle_index: 2,
                    is_image_based,
                },
                ..on_gpu(HardwareAccel::Vaapi)
            };

            assert_eq!(
                frame_route(&spec, FULL),
                FrameRoute::Composited,
                "a compositor makes the descent unnecessary, image based: {is_image_based}"
            );

            let args = plan_compositing(spec).to_ffmpeg_args();
            let graph = args
                .windows(2)
                .find(|pair| pair[0] == "-filter_complex")
                .map(|pair| pair[1].clone())
                .expect("a filter graph");

            assert!(
                !graph.contains("hwdownload"),
                "the video must never come down, image based: {is_image_based}"
            );
            assert!(
                graph.starts_with("[0:v]scale_vaapi=w=1280:h=532[base];"),
                "the scale still happens on the device: {graph}"
            );
            assert!(
                graph.ends_with("[base][sub]overlay_vaapi=eof_action=pass:repeatlast=0[v]"),
                "the composite happens on the device: {graph}"
            );
        }
    }

    /// Text is drawn onto a canvas of its own rather than onto the video.
    ///
    /// `sub2video=1` is the whole trick: it makes the `subtitles` filter
    /// produce pictures instead of writing over frames it was handed, which is
    /// what lets the video stay where it is.
    #[test]
    fn draws_text_onto_a_transparent_canvas_of_the_output_size() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 2,
                is_image_based: false,
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        let graph = composited_graph(
            "scale_vaapi=w=1280:h=532",
            HardwareAccel::Vaapi.pipeline().expect("a pipeline"),
            &spec.subtitles,
            &spec.input_path,
            1280,
            532,
        )
        .expect("a graph");

        assert_eq!(
            graph,
            "[0:v]scale_vaapi=w=1280:h=532[base];\
alphasrc=s=1280x532:r=25,format=bgra,\
subtitles='/media/film.mkv':si=2:alpha=1:sub2video=1,\
hwupload=derive_device=vaapi[sub];\
[base][sub]overlay_vaapi=eof_action=pass:repeatlast=0[v]"
        );
    }

    /// A bitmap subtitle is padded to the output rather than trusted to match.
    ///
    /// `SubtitleAction` does not carry the subtitle's own size, so the general
    /// form is the only correct one: a 1080p PGS track over a 2160p film shares
    /// the aspect ratio, but a 4:3 track over a widescreen film does not, and
    /// scaling that to fit would stretch it.
    #[test]
    fn pads_a_bitmap_subtitle_to_the_output_size() {
        let subtitles = SubtitleAction::BurnIn {
            subtitle_index: 0,
            is_image_based: true,
        };

        let graph = composited_graph(
            "scale_vaapi=w=1280:h=532",
            HardwareAccel::Vaapi.pipeline().expect("a pipeline"),
            &subtitles,
            "/media/film.mkv",
            1280,
            532,
        )
        .expect("a graph");

        assert!(
            graph.contains(
                "[0:s:0]scale,scale=-1:532:fast_bilinear,crop,\
pad=max(1280\\,iw):max(532\\,ih):(ow-iw)/2:(oh-ih)/2:black@0,crop=1280:532,\
format=bgra,hwupload=derive_device=vaapi[sub]"
            ),
            "{graph}"
        );
        assert!(
            !graph.contains("alphasrc"),
            "a bitmap subtitle is already a picture and needs no canvas"
        );
    }

    /// `overlay_cuda` composites in `yuva420p` where the rest take `bgra`.
    ///
    /// Handing a compositor the format it does not take is a filtergraph that
    /// will not configure, so the format belongs to the backend rather than to
    /// the chain that builds it.
    #[test]
    fn gives_each_compositor_the_format_it_takes() {
        for (accel, expected) in [
            (HardwareAccel::Nvenc, "yuva420p"),
            (HardwareAccel::Vaapi, "bgra"),
            (HardwareAccel::VideoToolbox, "bgra"),
            (HardwareAccel::Qsv, "bgra"),
            (HardwareAccel::Rkmpp, "bgra"),
        ] {
            let pipeline = accel.pipeline().expect("a pipeline");

            assert_eq!(pipeline.overlay_format, expected, "{accel:?}");

            let graph = composited_graph(
                "scale",
                pipeline,
                &SubtitleAction::BurnIn {
                    subtitle_index: 0,
                    is_image_based: true,
                },
                "/media/film.mkv",
                1280,
                532,
            )
            .expect("a graph");

            assert!(graph.contains(&format!("format={expected},")), "{accel:?}");
        }
    }

    /// A build without the compositor keeps the routes it had.
    ///
    /// The compositor is a property of the binary, and `overlay_videotoolbox`
    /// is a patch flux-ffmpeg carries rather than an upstream filter — so a
    /// stock macOS build has the scaler and no compositor, and has to fall back
    /// rather than emit a graph it cannot run.
    #[test]
    fn falls_back_when_the_build_has_no_compositor() {
        for (is_image_based, expected) in [
            (false, FrameRoute::DownAndBack),
            (true, FrameRoute::InSoftware),
        ] {
            let spec = SessionSpec {
                subtitles: SubtitleAction::BurnIn {
                    subtitle_index: 0,
                    is_image_based,
                },
                ..on_gpu(HardwareAccel::VideoToolbox)
            };

            assert_eq!(
                frame_route(&spec, SCALER_ONLY),
                expected,
                "image based: {is_image_based}"
            );
        }
    }

    /// The graph names its audio, because naming the video stops ffmpeg
    /// choosing streams by itself.
    #[test]
    fn maps_audio_alongside_the_composited_video() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        let args = plan_compositing(spec).to_ffmpeg_args();

        assert!(args.windows(2).any(|pair| pair == ["-map", "[v]"]));
        assert!(args.windows(2).any(|pair| pair == ["-map", "0:a?"]));
    }

    /// The canvas is redrawn often enough for the subtitles to keep time.
    #[test]
    fn redraws_the_text_canvas_at_a_sane_rate() {
        assert!(
            (10..=60).contains(&TEXT_OVERLAY_FPS),
            "below ten drops cues, above sixty renders frames nobody sees"
        );
    }

    #[test]
    fn scales_before_coming_down_rather_than_after() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: false,
            },
            ..on_gpu(HardwareAccel::Vaapi)
        };

        let args = plan(spec).to_ffmpeg_args();
        let chain = args
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain");

        let scale = chain.find("scale_vaapi").expect("a hardware scale");
        let down = chain.find("hwdownload").expect("a download");

        assert!(
            scale < down,
            "what crosses the bus should be the output picture, not the source"
        );
    }

    /// Compositing takes a second input, so it belongs to the other branch.
    #[test]
    fn leaves_bitmap_subtitles_in_software() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert_eq!(frame_route(&spec, SCALER_ONLY), FrameRoute::InSoftware);
    }

    #[test]
    fn leaves_tone_mapping_in_software_for_now() {
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

        assert_eq!(frame_route(&spec, SCALER_ONLY), FrameRoute::InSoftware);
    }

    #[test]
    fn a_route_that_comes_down_is_not_a_route_that_stays() {
        let spec = SessionSpec {
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: false,
            },
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu_of(&spec));
        assert!(frame_route(&spec, SCALER_ONLY).decodes_on_the_device());
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

    /// The scales do not agree and two of them do not even point the same way, so the mapping is
    /// checked rather than trusted. Every pairing here was run against the shipped build.
    #[test]
    fn asks_each_encoder_for_quality_on_its_own_scale() {
        for (encoder, flag, value) in [
            ("libx264", "-crf", "21"),
            ("libx265", "-crf", "24"),
            ("libsvtav1", "-crf", "32"),
            ("h264_videotoolbox", "-q:v", "62"),
            ("h264_nvenc", "-cq", "23"),
        ] {
            let arguments = rate_control_arguments(encoder, 2500);

            assert!(
                arguments.windows(2).any(|pair| pair == [flag, value]),
                "{encoder}: {arguments:?}"
            );
        }
    }

    /// `VideoToolbox` counts the other way. Sixty-two is a good picture there and near worthless as a
    /// CRF, so a value carried across from x264 would not be mistuned but inverted.
    #[test]
    fn does_not_hand_videotoolbox_a_crf_value() {
        let arguments = rate_control_arguments("h264_videotoolbox", 2500);

        assert!(
            !arguments.iter().any(|argument| argument == "-crf"),
            "{arguments:?}"
        );
    }

    /// The ceiling is the point. Without bufsize an encoder can satisfy maxrate on average and
    /// still burst through a scene at a rate the connection cannot carry.
    #[test]
    fn caps_every_encoder_with_a_window_to_measure_it_over() {
        for encoder in ["libx264", "h264_videotoolbox", "h264_vaapi", "h264_amf"] {
            let arguments = rate_control_arguments(encoder, 2500);

            assert!(
                arguments
                    .windows(2)
                    .any(|pair| pair == ["-maxrate", "2500k"]),
                "{encoder}: {arguments:?}"
            );
            assert!(
                arguments
                    .windows(2)
                    .any(|pair| pair == ["-bufsize", "5000k"]),
                "{encoder}: {arguments:?}"
            );
        }
    }

    /// A backend nobody has put a file through keeps what it had, capped rather than merely aimed
    /// at. Guessing a quality scale for it would be worse than the bitrate it already gets.
    #[test]
    fn leaves_an_unmeasured_backend_on_a_bitrate() {
        for encoder in ["h264_vaapi", "hevc_qsv", "h264_amf", "h264_rkmpp"] {
            let arguments = rate_control_arguments(encoder, 2500);

            assert!(
                arguments.windows(2).any(|pair| pair == ["-b:v", "2500k"]),
                "{encoder}: {arguments:?}"
            );
        }
    }

    /// VP9 refuses a quality target with nothing to anchor it to: "Rate control parameters set
    /// without a bitrate". Measured, and the reason this exception exists.
    #[test]
    fn gives_vp9_the_bitrate_it_insists_on_alongside_the_quality() {
        let arguments = rate_control_arguments("libvpx-vp9", 2500);

        assert!(
            arguments.windows(2).any(|pair| pair == ["-crf", "32"]),
            "{arguments:?}"
        );
        assert!(
            arguments.windows(2).any(|pair| pair == ["-b:v", "2500k"]),
            "{arguments:?}"
        );
    }

    /// A quality targeted encoder must not also be told to hit a bitrate, which is the instruction
    /// the quality target replaces.
    #[test]
    fn does_not_ask_a_quality_targeted_encoder_to_hit_a_bitrate_as_well() {
        let arguments = rate_control_arguments("libx264", 2500);

        assert!(
            !arguments.iter().any(|argument| argument == "-b:v"),
            "{arguments:?}"
        );
    }

    #[test]
    fn survives_a_source_of_no_size() {
        assert_eq!(fitted_size((0, 0), 1280, 720), (1280, 720));
    }

    #[test]
    fn keeps_frames_on_the_gpu_for_a_plain_rescale() {
        assert!(keeps_frames_on_the_gpu_of(&on_gpu(
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

        assert!(!keeps_frames_on_the_gpu_of(&spec));
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

        assert!(!keeps_frames_on_the_gpu_of(&spec));
    }

    #[test]
    fn will_not_guess_a_size_it_was_not_given() {
        let spec = SessionSpec {
            source_size: None,
            ..on_gpu(HardwareAccel::VideoToolbox)
        };

        assert!(!keeps_frames_on_the_gpu_of(&spec));
    }

    #[test]
    fn stays_in_software_when_the_build_has_no_scaler() {
        let spec = on_gpu(HardwareAccel::VideoToolbox);

        assert!(keeps_frames_on_the_gpu(&spec, SCALER_ONLY));
        assert!(
            !keeps_frames_on_the_gpu(&spec, DeviceFilters::default()),
            "a chain that names a filter this build lacks fails and falls back for no reason"
        );
    }

    #[test]
    fn keeps_rockchip_frames_on_the_gpu() {
        let pipeline = HardwareAccel::Rkmpp
            .pipeline()
            .expect("Rkmpp declares a pipeline");

        assert_eq!(pipeline.output_format, "drm_prime");
        assert_eq!(pipeline.scaler, "scale_rkrga");
        assert!(keeps_frames_on_the_gpu_of(&on_gpu(HardwareAccel::Rkmpp)));
    }

    #[test]
    fn leaves_backends_with_no_pipeline_alone() {
        for accel in [HardwareAccel::Amf, HardwareAccel::None] {
            assert!(
                !keeps_frames_on_the_gpu_of(&on_gpu(accel)),
                "{accel:?} has no end to end pipeline"
            );
        }
    }

    #[test]
    fn opens_the_device_it_was_given_rather_than_a_fixed_one() {
        let plan = TranscodePlan {
            spec: on_gpu(HardwareAccel::Vaapi),
            output_directory: "/transcodes/abc".into(),
            device_filters: SCALER_ONLY,
            device: "/dev/dri/renderD129".into(),
            start_at: SegmentStart::default(),
            cut_seconds: 4.0,
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

        assert!(!keeps_frames_on_the_gpu_of(&spec));
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

    /// A build with a hardware scaler and no compositor, which is what the
    /// fallback routes are about.
    fn plan(spec: SessionSpec) -> TranscodePlan {
        plan_on(spec, SCALER_ONLY)
    }

    /// A build with both, which is what the shipped package has.
    fn plan_compositing(spec: SessionSpec) -> TranscodePlan {
        plan_on(spec, FULL)
    }

    fn plan_on(spec: SessionSpec, device_filters: DeviceFilters) -> TranscodePlan {
        TranscodePlan {
            device: DEFAULT_DEVICE.to_owned(),
            device_filters,
            spec,
            output_directory: "/transcodes/abc".into(),
            start_at: SegmentStart::default(),
            cut_seconds: 4.0,
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
        let mut session = plan(spec());
        session.start_at = SegmentStart {
            index: 9,
            seconds: 90.0,
        };

        let args = session.to_ffmpeg_args();

        let seek = args.iter().position(|a| a == "-ss");
        let input = args.iter().position(|a| a == "-i");

        assert!(seek.is_some(), "expected a seek");
        assert!(seek < input, "expected -ss before -i");
    }

    #[test]
    fn omits_the_seek_when_starting_at_zero() {
        assert!(!plan(spec()).to_ffmpeg_args().iter().any(|a| a == "-ss"));
    }

    #[test]
    /// Fragmented MP4 rather than transport streams.
    ///
    /// Transport streams were the one global answer while a copied HEVC film
    /// was stopping twenty-three seconds in as fMP4, but the container was not
    /// the fault: the segments were opening on cuts a decoder cannot start at,
    /// and those are refused before a copy is agreed to. Measured against the
    /// same film, HEVC Main 10 in fMP4 plays every one of its frames.
    /// See FLUX-114 and FLUX-124.
    fn writes_fragmented_mp4_segments_into_the_session_directory() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(args.contains(&"/transcodes/abc/segment%05d.m4s".to_owned()));
        assert!(args.contains(&"/transcodes/abc/run.m3u8".to_owned()));
        assert!(args.contains(&"fmp4".to_owned()));
        assert!(args.contains(&"init.mp4".to_owned()));
    }

    /// A client that cannot take fragmented MP4 still gets a film.
    ///
    /// The container is a property of the treatment, so asking for transport
    /// streams has to produce them and nothing of fMP4's shape alongside: an
    /// `EXT-X-MAP` pointing at an initialisation segment no run will write is
    /// a playlist that cannot play. See FLUX-115.
    #[test]
    fn writes_transport_streams_for_a_client_that_needs_them() {
        let args = plan(SessionSpec {
            container: SegmentContainer::MpegTs,
            ..spec()
        })
        .to_ffmpeg_args();

        assert!(args.contains(&"/transcodes/abc/segment%05d.ts".to_owned()));
        assert!(!args.iter().any(|argument| argument == "-hls_segment_type"));
        assert!(!args
            .iter()
            .any(|argument| argument == "-hls_fmp4_init_filename"));
    }

    /// The media's clock is the film's clock.
    ///
    /// The mpegts muxer starts its own at 1.4 seconds by default, so every
    /// timestamp in every segment was 1.4 seconds further on than the moment of
    /// film it held. Harmless to play, since the engine places each segment by
    /// the playlist regardless, and pure noise in a log or a probe. Measured:
    /// it moves the offset from 1.483s to 0.083s and moves nothing else.
    #[test]
    fn starts_the_muxers_clock_where_the_film_starts() {
        let args = plan(spec()).to_ffmpeg_args();

        let at = |name: &str| args.iter().position(|argument| argument == name);

        assert_eq!(
            at("-muxdelay").map(|index| args[index + 1].clone()),
            Some("0".to_owned())
        );
        assert_eq!(
            at("-muxpreload").map(|index| args[index + 1].clone()),
            Some("0".to_owned())
        );
    }

    /// The playlist Flux serves describes the whole film, and ffmpeg's does
    /// not. A run that wrote over it would replace the film with the part of
    /// it that had been transcoded so far.
    #[test]
    fn leaves_the_playlist_flux_writes_alone() {
        let args = plan(spec()).to_ffmpeg_args();

        assert!(!args.iter().any(|argument| argument.ends_with("index.m3u8")));
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

        let graph = args
            .iter()
            .find(|a| a.contains("overlay"))
            .expect("a graph that composites");

        assert!(graph.contains("[0:s:2]"), "the subtitle is read: {graph}");
        assert!(
            graph.contains("[base][sub]overlay=eof_action=pass:repeatlast=0[v]"),
            "the subtitle is drawn onto the picture, and outlasts nothing: {graph}"
        );
        assert!(
            !args.iter().any(|a| a == "-vf"),
            "a graph replaces the chain"
        );
    }

    /// A bitmap subtitle is brought to the size of the picture first.
    ///
    /// The software route used to overlay the subtitle stream untouched, which
    /// places its canvas at the origin. A canvas taller than the output — 161
    /// files in the reference library, and every file at all once a session
    /// scales down — then carries its text below the frame, so the burn-in
    /// encoded the whole film again and drew nothing on it.
    #[test]
    fn sizes_a_bitmap_subtitle_to_the_picture_it_is_drawn_on() {
        let args = plan(SessionSpec {
            video: VideoAction::Encode {
                encoder: "libx264".into(),
                max_bitrate_kbps: 4000,
                max_width: 1280,
                max_height: 720,
                tone_map: None,
            },
            subtitles: SubtitleAction::BurnIn {
                subtitle_index: 0,
                is_image_based: true,
            },
            source_size: Some((1920, 1080)),
            ..spec()
        })
        .to_ffmpeg_args();

        let graph = args
            .iter()
            .find(|a| a.contains("overlay"))
            .expect("a graph that composites");

        assert!(
            graph.contains("crop=1280:720"),
            "the subtitle is cropped to the size the picture leaves at: {graph}"
        );
        assert!(
            graph.contains("pad=max(1280\\,iw):max(720\\,ih)"),
            "a subtitle smaller than the picture is padded rather than stretched: {graph}"
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
