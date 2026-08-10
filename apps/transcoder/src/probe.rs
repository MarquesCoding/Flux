use std::path::Path;

use serde::Deserialize;
use thiserror::Error;
use tokio::process::Command;

use crate::media::Chapter;
use crate::media::{
    audio_codec, bit_depth_from_pix_fmt, is_image_subtitle, subtitle_format, video_codec,
    AudioStream, Container, MediaProbe, SubtitleStream, VideoRange, VideoStream,
};

/// Why a probe failed.
#[derive(Debug, Error)]
pub enum ProbeError {
    #[error("could not run ffprobe: {0}")]
    Spawn(#[from] std::io::Error),
    #[error("ffprobe exited with status {status}: {stderr}")]
    Failed { status: i32, stderr: String },
    #[error("could not parse ffprobe output: {0}")]
    Parse(#[from] serde_json::Error),
}

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    #[serde(default)]
    streams: Vec<FfprobeStream>,
    format: Option<FfprobeFormat>,
    #[serde(default)]
    chapters: Vec<FfprobeChapter>,
}

#[derive(Debug, Deserialize)]
struct FfprobeChapter {
    start_time: Option<String>,
    end_time: Option<String>,
    #[serde(default)]
    tags: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    #[serde(default)]
    format_name: String,
    duration: Option<String>,
    bit_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    index: u32,
    codec_type: Option<String>,
    codec_name: Option<String>,
    profile: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    channels: Option<u8>,
    bit_rate: Option<String>,
    bits_per_raw_sample: Option<String>,
    pix_fmt: Option<String>,
    color_transfer: Option<String>,
    #[serde(default)]
    tags: std::collections::HashMap<String, String>,
    disposition: Option<std::collections::HashMap<String, i32>>,
    #[serde(default)]
    side_data_list: Vec<std::collections::HashMap<String, serde_json::Value>>,
}

fn parse_kbps(value: Option<&String>) -> Option<u32> {
    value
        .and_then(|raw| raw.parse::<u64>().ok())
        .map(|bits| u32::try_from(bits / 1000).unwrap_or(u32::MAX))
}

/// Determines the dynamic range of a video stream.
///
/// Dolby Vision and HDR10+ are carried as side data alongside an ordinary PQ
/// transfer function, so side data is checked before the transfer curve.
/// Reporting HDR10 for a Dolby Vision stream would silently discard the
/// dynamic metadata during transcoding, which is the failure this ordering
/// exists to prevent. See ADR-0010.
fn detect_range(stream: &FfprobeStream) -> VideoRange {
    for side_data in &stream.side_data_list {
        let kind = side_data
            .get("side_data_type")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();

        if kind.contains("DOVI") || kind.contains("Dolby Vision") {
            return VideoRange::DolbyVision;
        }

        if kind.contains("HDR Dynamic Metadata") || kind.contains("SMPTE2094") {
            return VideoRange::Hdr10Plus;
        }
    }

    match stream.color_transfer.as_deref() {
        Some("smpte2084") => VideoRange::Hdr10,
        Some("arib-std-b67") => VideoRange::Hlg,
        _ => VideoRange::Sdr,
    }
}

fn is_atmos(stream: &FfprobeStream) -> bool {
    stream
        .profile
        .as_deref()
        .is_some_and(|profile| profile.contains("Atmos") || profile.contains("JOC"))
}

fn language_of(stream: &FfprobeStream) -> Option<String> {
    stream
        .tags
        .get("language")
        .filter(|value| value.as_str() != "und")
        .cloned()
}

/// What a stream calls itself, if it says.
fn title_of(stream: &FfprobeStream) -> Option<String> {
    stream
        .tags
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("title"))
        .map(|(_, value)| value.clone())
        .filter(|value| !value.trim().is_empty())
}

/// Whether the container marks a stream as the one to use.
fn is_default(stream: &FfprobeStream) -> bool {
    stream
        .disposition
        .as_ref()
        .and_then(|disposition| disposition.get("default"))
        .is_some_and(|flag| *flag == 1)
}

fn is_forced(stream: &FfprobeStream) -> bool {
    stream
        .disposition
        .as_ref()
        .and_then(|disposition| disposition.get("forced"))
        .is_some_and(|forced| *forced == 1)
}

fn to_media_probe(output: &FfprobeOutput, path: &Path) -> MediaProbe {
    let format = output.format.as_ref();

    let video = output
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"))
        .map(|stream| VideoStream {
            index: stream.index,
            codec: video_codec(stream.codec_name.as_deref().unwrap_or_default()),
            width: stream.width.unwrap_or_default(),
            height: stream.height.unwrap_or_default(),
            range: detect_range(stream),
            bitrate_kbps: parse_kbps(stream.bit_rate.as_ref()),
            bit_depth: stream
                .bits_per_raw_sample
                .as_ref()
                .and_then(|value| value.parse::<u8>().ok())
                .or_else(|| stream.pix_fmt.as_deref().and_then(bit_depth_from_pix_fmt)),
        });

    let audio_streams = output
        .streams
        .iter()
        .filter(|stream| stream.codec_type.as_deref() == Some("audio"))
        .map(|stream| AudioStream {
            index: stream.index,
            codec: audio_codec(stream.codec_name.as_deref().unwrap_or_default()),
            channels: stream.channels.unwrap_or(2),
            language: language_of(stream),
            title: title_of(stream),
            is_default: is_default(stream),
            is_atmos: is_atmos(stream),
        })
        .collect();

    let subtitle_streams = output
        .streams
        .iter()
        .filter(|stream| stream.codec_type.as_deref() == Some("subtitle"))
        .map(|stream| {
            let format = subtitle_format(stream.codec_name.as_deref().unwrap_or_default());

            SubtitleStream {
                index: stream.index,
                format: format.to_owned(),
                language: language_of(stream),
                is_forced: is_forced(stream),
                is_image_based: is_image_subtitle(format),
            }
        })
        .collect();

    MediaProbe {
        container: Container::detect(
            format.map(|f| f.format_name.as_str()).unwrap_or_default(),
            path,
        ),
        duration_seconds: format
            .and_then(|f| f.duration.as_ref())
            .and_then(|value| value.parse::<f64>().ok())
            .unwrap_or_default(),
        bitrate_kbps: parse_kbps(format.and_then(|f| f.bit_rate.as_ref())),
        video,
        audio_streams,
        subtitle_streams,
        chapters: output
            .chapters
            .iter()
            .filter_map(|chapter| {
                let start = chapter.start_time.as_ref()?.parse::<f64>().ok()?;
                let end = chapter.end_time.as_ref()?.parse::<f64>().ok()?;

                Some(Chapter {
                    title: chapter
                        .tags
                        .iter()
                        .find(|(key, _)| key.eq_ignore_ascii_case("title"))
                        .map(|(_, value)| value.clone()),
                    start_seconds: start,
                    end_seconds: end,
                })
            })
            .collect(),
    }
}

/// Parses ffprobe JSON into a `MediaProbe`.
///
/// Kept separate from process spawning so that parsing is testable against
/// captured output without touching the filesystem. The path is read for its
/// extension alone, because one demuxer serves the whole ISO base media family
/// and its name cannot say which member a file is.
///
/// # Errors
///
/// Returns [`ProbeError::Parse`] when the JSON does not match ffprobe's
/// documented output.
pub fn parse_ffprobe_output(json: &str, path: &Path) -> Result<MediaProbe, ProbeError> {
    let output: FfprobeOutput = serde_json::from_str(json)?;

    Ok(to_media_probe(&output, path))
}

/// Probes a media file.
///
/// Everything Flux believes about a file comes from here. Nothing is inferred
/// from the filename, because filenames in real libraries are unreliable.
///
/// # Errors
///
/// Returns [`ProbeError::Spawn`] when ffprobe cannot be run,
/// [`ProbeError::Failed`] when it rejects the file, and
/// [`ProbeError::Parse`] when its output cannot be read.
pub async fn probe_media(ffprobe: &str, path: &Path) -> Result<MediaProbe, ProbeError> {
    let output = Command::new(ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            "-show_chapters",
        ])
        .arg(path)
        .output()
        .await?;

    if !output.status.success() {
        return Err(ProbeError::Failed {
            status: output.status.code().unwrap_or(-1),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }

    parse_ffprobe_output(&String::from_utf8_lossy(&output.stdout), path)
}

#[cfg(test)]
mod tests {
    use super::parse_ffprobe_output;
    use crate::media::{Container, VideoRange};
    use std::path::Path;

    const HDR10_JSON: &str = r#"{
        "streams": [
            {"index": 0, "codec_type": "video", "codec_name": "hevc", "width": 3840,
             "height": 2160, "color_transfer": "smpte2084", "bits_per_raw_sample": "10"},
            {"index": 1, "codec_type": "audio", "codec_name": "eac3", "channels": 6,
             "profile": "Dolby Digital Plus + Dolby Atmos", "tags": {"language": "eng"}}
        ],
        "format": {"format_name": "matroska,webm", "duration": "7200.5", "bit_rate": "24000000"}
    }"#;

    #[test]
    fn reads_container_duration_and_bitrate() {
        let probe = parse_ffprobe_output(HDR10_JSON, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.container, Container::Mkv);
        assert!((probe.duration_seconds - 7200.5).abs() < f64::EPSILON);
        assert_eq!(probe.bitrate_kbps, Some(24000));
    }

    #[test]
    fn detects_hdr10_from_the_transfer_curve() {
        let probe = parse_ffprobe_output(HDR10_JSON, Path::new("/media/film.mkv")).expect("parses");
        let video = probe.video.expect("has video");

        assert_eq!(video.range, VideoRange::Hdr10);
        assert_eq!(video.bit_depth, Some(10));
    }

    #[test]
    fn detects_atmos_from_the_audio_profile() {
        let probe = parse_ffprobe_output(HDR10_JSON, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.audio_streams[0].is_atmos);
        assert_eq!(probe.audio_streams[0].language.as_deref(), Some("eng"));
    }

    #[test]
    fn prefers_dolby_vision_side_data_over_the_transfer_curve() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084",
            "side_data_list": [{"side_data_type": "DOVI configuration record"}]}],
            "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(
            probe.video.expect("has video").range,
            VideoRange::DolbyVision
        );
    }

    #[test]
    fn prefers_hdr10_plus_side_data_over_the_transfer_curve() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084",
            "side_data_list": [{"side_data_type": "HDR Dynamic Metadata SMPTE2094-40"}]}],
            "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.video.expect("has video").range, VideoRange::Hdr10Plus);
    }

    #[test]
    fn detects_hlg() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "arib-std-b67"}], "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.video.expect("has video").range, VideoRange::Hlg);
    }

    #[test]
    fn treats_an_absent_transfer_curve_as_sdr() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "h264"}],
            "format": {"format_name": "mov,mp4"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.video.expect("has video").range, VideoRange::Sdr);
    }

    #[test]
    fn marks_image_subtitles() {
        let json = r#"{"streams": [
            {"index": 2, "codec_type": "subtitle", "codec_name": "hdmv_pgs_subtitle",
             "tags": {"language": "eng"}, "disposition": {"forced": 1}},
            {"index": 3, "codec_type": "subtitle", "codec_name": "subrip"}],
            "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.subtitle_streams[0].format, "pgs");
        assert!(probe.subtitle_streams[0].is_image_based);
        assert!(probe.subtitle_streams[0].is_forced);
        assert!(!probe.subtitle_streams[1].is_image_based);
    }

    #[test]
    fn ignores_undefined_languages() {
        let json = r#"{"streams": [{"index": 1, "codec_type": "audio", "codec_name": "aac",
            "channels": 2, "tags": {"language": "und"}}], "format": {"format_name": "mov,mp4"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.audio_streams[0].language, None);
    }

    #[test]
    fn handles_a_file_with_no_video_stream() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "audio", "codec_name": "flac",
            "channels": 2}], "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.video.is_none());
        assert_eq!(probe.audio_streams.len(), 1);
    }

    #[test]
    fn reads_what_a_track_calls_itself() {
        let json = r#"{
            "streams": [{
                "index": 1,
                "codec_type": "audio",
                "codec_name": "ac3",
                "channels": 6,
                "tags": {"language": "eng", "title": "Director's Commentary"},
                "disposition": {"default": 0}
            }],
            "format": {"format_name": "matroska,webm"}
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(
            probe.audio_streams[0].title.as_deref(),
            Some("Director's Commentary")
        );
        assert!(!probe.audio_streams[0].is_default);
    }

    #[test]
    fn notices_the_track_a_container_marks_as_default() {
        let json = r#"{
            "streams": [{
                "index": 1,
                "codec_type": "audio",
                "codec_name": "aac",
                "channels": 2,
                "disposition": {"default": 1}
            }],
            "format": {"format_name": "matroska,webm"}
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.audio_streams[0].is_default);
        assert!(probe.audio_streams[0].title.is_none());
    }

    #[test]
    fn ignores_a_title_that_is_only_whitespace() {
        let json = r#"{
            "streams": [{
                "index": 1,
                "codec_type": "audio",
                "codec_name": "aac",
                "channels": 2,
                "tags": {"title": "   "}
            }],
            "format": {"format_name": "matroska,webm"}
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.audio_streams[0].title.is_none());
    }

    #[test]
    fn reads_chapters_a_container_names() {
        let json = r#"{
            "streams": [],
            "format": {"format_name": "matroska,webm", "duration": "1440.0"},
            "chapters": [
                {"start_time": "0.000000", "end_time": "90.000000", "tags": {"title": "Intro"}},
                {"start_time": "90.000000", "end_time": "1400.000000", "tags": {"title": "Episode"}}
            ]
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.chapters.len(), 2);
        assert_eq!(probe.chapters[0].title.as_deref(), Some("Intro"));
        assert!((probe.chapters[0].end_seconds - 90.0).abs() < f64::EPSILON);
    }

    #[test]
    fn reads_a_chapter_with_no_title() {
        let json = r#"{
            "streams": [],
            "format": {"format_name": "matroska,webm"},
            "chapters": [{"start_time": "0.0", "end_time": "10.0", "tags": {}}]
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.chapters.len(), 1);
        assert!(probe.chapters[0].title.is_none());
    }

    #[test]
    fn skips_a_chapter_with_no_usable_times() {
        let json = r#"{
            "streams": [],
            "format": {"format_name": "matroska,webm"},
            "chapters": [{"tags": {"title": "Broken"}}]
        }"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.chapters.is_empty());
    }

    #[test]
    fn reports_no_chapters_for_a_file_that_has_none() {
        let json = r#"{"streams": [], "format": {"format_name": "matroska,webm"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert!(probe.chapters.is_empty());
    }

    #[test]
    fn rejects_output_that_is_not_json() {
        assert!(parse_ffprobe_output("not json", Path::new("/media/film.mkv")).is_err());
    }
}
