use std::path::Path;

use serde::{Deserialize, Serialize};

/// The dynamic range of a video stream.
///
/// Detected from colour transfer characteristics and side data rather than
/// from the container or filename, which routinely lie.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VideoRange {
    #[serde(rename = "SDR")]
    Sdr,
    #[serde(rename = "HDR10")]
    Hdr10,
    #[serde(rename = "HDR10Plus")]
    Hdr10Plus,
    #[serde(rename = "HLG")]
    Hlg,
    #[serde(rename = "DolbyVision")]
    DolbyVision,
}

/// A container format Valence recognises.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Container {
    Mp4,
    Mkv,
    Webm,
    Ts,
    M2ts,
    Mov,
    Avi,
    Unknown,
}

impl Container {
    /// Maps an ffprobe `format_name` list onto a container.
    ///
    /// ffprobe reports a comma separated list of every format the demuxer
    /// matched, so the first recognised entry wins rather than the first
    /// entry.
    ///
    /// One demuxer reads the whole ISO base media family and reports the same
    /// list — `mov,mp4,m4a,3gp,3g2,mj2` — for every file it opens, so nothing
    /// in that list says which of them a file actually is. Use
    /// [`Container::detect`] where the path is known; this treats the family
    /// as MP4, which is what almost every such file is and what clients
    /// declare support for.
    #[must_use]
    pub fn from_format_name(format_name: &str) -> Self {
        for name in format_name.split(',') {
            match name.trim() {
                "mov" | "mp4" | "m4a" | "3gp" | "mj2" => return Self::Mp4,
                "matroska" => return Self::Mkv,
                "webm" => return Self::Webm,
                "mpegts" => return Self::Ts,
                "avi" => return Self::Avi,
                _ => {}
            }
        }

        Self::Unknown
    }

    /// Maps an ffprobe `format_name` list onto a container, using the path to
    /// tell members of the ISO base media family apart.
    ///
    /// Reporting every `MP4` as `QuickTime` is not cosmetic: a client declares
    /// direct play for `mp4` and not for `mov`, so the whole library would be
    /// remuxed for no reason.
    #[must_use]
    pub fn detect(format_name: &str, path: &Path) -> Self {
        let container = Self::from_format_name(format_name);

        if container != Self::Mp4 {
            return container;
        }

        let extension = path
            .extension()
            .map(|value| value.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if extension == "mov" {
            Self::Mov
        } else {
            Self::Mp4
        }
    }
}

/// A named point in a file.
///
/// Containers carry these for scene selection, and a release that names one
/// "Intro" or "Opening" has already done the work of finding it. Reading them
/// costs nothing beyond the probe that was happening anyway.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chapter {
    pub title: Option<String>,
    pub start_seconds: f64,
    pub end_seconds: f64,
}

/// A video stream as Valence models it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStream {
    pub index: u32,
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub range: VideoRange,
    /// What a player that cannot read this stream's dynamic metadata sees instead.
    ///
    /// The same as `range` for everything with nothing extra to ignore. Dolby Vision profile 8.1
    /// and HDR10+ both carry a base layer another kind of player reads correctly on its own, which
    /// is the whole reason they were specified that way, and a server that ignores it re-encodes
    /// films that would have played untouched.
    pub range_base: VideoRange,
    pub bitrate_kbps: Option<u32>,
    pub bit_depth: Option<u8>,
    /// The codec level, as the codec itself numbers it.
    ///
    /// Not comparable across codecs: H.264 reports level 5.1 as 51 and HEVC
    /// reports level 2.1 as 63, because one scales by ten and the other by
    /// thirty. Whoever compares it has to know which codec it came from.
    pub level: Option<u32>,
    pub frame_rate: Option<f64>,
    /// Whether the picture is stored as fields rather than whole frames.
    pub is_interlaced: bool,
    /// How many frames the decoder must keep to decode the next one.
    ///
    /// Only known once a frame has been read, because it comes from the
    /// decoder rather than the container.
    ///
    /// Meaningful for H.264 and not for HEVC: ffprobe reports the real count
    /// for the first and a flat 1 for the second, whatever the stream holds.
    /// Measured on a 4K HEVC remux that reports 1 beside an H.264 fixture
    /// encoded with nine that reports nine. A ceiling therefore never refuses
    /// an HEVC source, which fails open rather than shut and is the right way
    /// round for a fact we cannot read.
    pub ref_frames: Option<u32>,
    /// The shape of a pixel, where it is not square.
    ///
    /// Absent means square, which is what almost everything is. A source with
    /// non-square pixels shown as though they were square is the wrong shape.
    pub pixel_aspect: Option<String>,
    pub rotation_degrees: Option<i32>,
}

/// An audio stream as Valence models it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStream {
    pub index: u32,
    pub codec: String,
    pub channels: u8,
    pub sample_rate: Option<u32>,
    /// What the codec calls this encoding, where it distinguishes them.
    ///
    /// A client that decodes AAC-LC may refuse HE-AAC, which is the same codec
    /// name and a different thing.
    pub profile: Option<String>,
    pub language: Option<String>,
    /// What the file calls this track.
    ///
    /// Often the only thing distinguishing two streams of the same language:
    /// "Commentary" and "Director's Cut" carry no language of their own.
    pub title: Option<String>,
    /// Whether the container marks this as the track to play.
    pub is_default: bool,
    pub is_atmos: bool,
}

/// A subtitle stream as Valence models it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleStream {
    pub index: u32,
    pub format: String,
    pub language: Option<String>,
    /// What the file calls this track.
    ///
    /// Often the only thing telling two tracks of one language apart:
    /// "Signs & Songs" and "Full" carry no language of their own.
    pub title: Option<String>,
    /// Whether the container marks this as the track to show.
    pub is_default: bool,
    pub is_forced: bool,
    /// Image based subtitles cannot be converted to text and must be burned in
    /// when the client cannot render them.
    pub is_image_based: bool,
}

/// Everything Valence needs to know about a media file to negotiate playback.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    pub container: Container,
    pub duration_seconds: f64,
    pub bitrate_kbps: Option<u32>,
    pub video: Option<VideoStream>,
    pub audio_streams: Vec<AudioStream>,
    pub subtitle_streams: Vec<SubtitleStream>,
    #[serde(default)]
    pub chapters: Vec<Chapter>,
    /// Whether this source can be delivered by copying it.
    ///
    /// Absent unless somebody asked, because answering costs a read of the
    /// whole packet index and most callers are probing for something else. The
    /// library scan asks, so the decision to copy or encode is made once per
    /// file rather than once per session. See VAL-125.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_copy_segments: Option<bool>,
}

/// Maps an ffmpeg subtitle codec name onto the Valence subtitle format names
/// shared with the client.
#[must_use]
pub fn subtitle_format(codec_name: &str) -> &'static str {
    match codec_name {
        "subrip" | "srt" => "srt",
        "webvtt" => "webvtt",
        "ass" => "ass",
        "ssa" => "ssa",
        "dvd_subtitle" => "vobsub",
        "hdmv_pgs_subtitle" => "pgs",
        "dvb_subtitle" => "dvbsub",
        _ => "unknown",
    }
}

/// Reports whether a subtitle format is a bitmap that cannot be converted to
/// text, and therefore has to be burned into the video when unsupported.
#[must_use]
pub fn is_image_subtitle(format: &str) -> bool {
    matches!(format, "vobsub" | "pgs" | "dvbsub")
}

/// Maps an ffmpeg audio codec name onto the Valence audio codec names.
#[must_use]
pub fn audio_codec(codec_name: &str) -> String {
    if codec_name.starts_with("pcm_") {
        return "pcm".to_owned();
    }

    match codec_name {
        "dts" => "dts".to_owned(),
        other => other.to_owned(),
    }
}

/// Derives the bit depth from a pixel format.
///
/// `bits_per_raw_sample` is absent from a great many real files, so the pixel
/// format is the reliable signal. Without this, 10-bit HEVC is reported as
/// unknown depth and the negotiator cannot tell whether a client that only
/// handles 8-bit needs a transcode.
#[must_use]
pub fn bit_depth_from_pix_fmt(pix_fmt: &str) -> Option<u8> {
    for (suffix, depth) in [("12le", 12), ("12be", 12), ("10le", 10), ("10be", 10)] {
        if pix_fmt.ends_with(suffix) {
            return Some(depth);
        }
    }

    if pix_fmt.starts_with("yuv") || pix_fmt.starts_with("gbr") || pix_fmt.starts_with("nv") {
        return Some(8);
    }

    None
}

/// Maps an ffmpeg video codec name onto the Valence video codec names.
#[must_use]
pub fn video_codec(codec_name: &str) -> String {
    match codec_name {
        "mpeg2video" => "mpeg2".to_owned(),
        other => other.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{audio_codec, is_image_subtitle, subtitle_format, video_codec, Container};

    #[test]
    fn maps_matroska_before_webm() {
        assert_eq!(Container::from_format_name("matroska,webm"), Container::Mkv);
    }

    #[test]
    fn maps_the_mp4_family() {
        assert_eq!(
            Container::from_format_name("mov,mp4,m4a,3gp,3g2,mj2"),
            Container::Mp4
        );
    }

    #[test]
    fn tells_quicktime_from_mp4_by_the_path() {
        assert_eq!(
            Container::detect("mov,mp4,m4a,3gp,3g2,mj2", Path::new("/media/film.mov")),
            Container::Mov
        );
    }

    #[test]
    fn reads_the_shared_demuxer_name_as_mp4_for_an_mp4_file() {
        assert_eq!(
            Container::detect("mov,mp4,m4a,3gp,3g2,mj2", Path::new("/media/film.mp4")),
            Container::Mp4
        );
    }

    #[test]
    fn falls_back_to_mp4_when_the_file_has_no_extension() {
        assert_eq!(
            Container::detect("mov,mp4,m4a,3gp,3g2,mj2", Path::new("/media/film")),
            Container::Mp4
        );
    }

    #[test]
    fn the_path_never_overrides_a_container_the_demuxer_named_exactly() {
        assert_eq!(
            Container::detect("matroska,webm", Path::new("/media/film.mov")),
            Container::Mkv
        );
    }

    #[test]
    fn maps_transport_streams() {
        assert_eq!(Container::from_format_name("mpegts"), Container::Ts);
    }

    #[test]
    fn reports_unknown_containers() {
        assert_eq!(Container::from_format_name("rm,rmvb"), Container::Unknown);
    }

    #[test]
    fn maps_subtitle_codecs() {
        assert_eq!(subtitle_format("subrip"), "srt");
        assert_eq!(subtitle_format("hdmv_pgs_subtitle"), "pgs");
        assert_eq!(subtitle_format("dvd_subtitle"), "vobsub");
    }

    #[test]
    fn identifies_image_subtitles() {
        assert!(is_image_subtitle("pgs"));
        assert!(is_image_subtitle("vobsub"));
        assert!(!is_image_subtitle("srt"));
    }

    #[test]
    fn collapses_pcm_variants() {
        assert_eq!(audio_codec("pcm_s16le"), "pcm");
        assert_eq!(audio_codec("pcm_s24be"), "pcm");
        assert_eq!(audio_codec("aac"), "aac");
    }

    #[test]
    fn reads_bit_depth_from_the_pixel_format() {
        use super::bit_depth_from_pix_fmt;

        assert_eq!(bit_depth_from_pix_fmt("yuv420p10le"), Some(10));
        assert_eq!(bit_depth_from_pix_fmt("yuv420p12be"), Some(12));
        assert_eq!(bit_depth_from_pix_fmt("yuv420p"), Some(8));
        assert_eq!(bit_depth_from_pix_fmt("nv12"), Some(8));
        assert_eq!(bit_depth_from_pix_fmt("rgb24"), None);
    }

    #[test]
    fn renames_mpeg2_video() {
        assert_eq!(video_codec("mpeg2video"), "mpeg2");
        assert_eq!(video_codec("hevc"), "hevc");
    }
}
