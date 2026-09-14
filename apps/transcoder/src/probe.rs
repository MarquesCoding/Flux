use std::collections::HashMap;
use std::path::Path;

use serde::Deserialize;
use thiserror::Error;
use tokio::process::Command;

use crate::media::Chapter;
use crate::media::{
    audio_codec, bit_depth_from_pix_fmt, is_image_subtitle, subtitle_format, video_codec,
    AudioStream, Container, MediaProbe, SubtitleStream, VideoRange, VideoStream,
};

/// What this version of Valence decides about a file when it probes it.
///
/// The mirror of `LAYOUT` in `boundaries.rs`, for the library rather than for a
/// plan's directory. Bumped whenever a rule that turns a file into a stored
/// answer changes — which streams are read, what counts as copyable, what a
/// range or a bit depth is taken to be — because a row written under an older
/// rule holds an answer this build would not give, and nothing else would ever
/// go back and ask again.
///
/// The scan only reprobes a file whose size or modification time moved, or
/// whose columns are still null. A rule change moves neither, so relaxing the
/// open-GOP refusal in VAL-145 changed nothing on its own: `canCopySegments`
/// was already false for 9 of 19 films and no scan would revisit it. It took a
/// migration nulling those rows by hand, and the next change would have taken
/// another. Comparing this instead makes it automatic, and closes the trap
/// where a rule fix looks right in dev — the file gets rescanned there for
/// other reasons — and silently does nothing on an install where it does not.
pub const PROBE_VERSION: u32 = 1;

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
    #[serde(default)]
    frames: Vec<FfprobeFrame>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFrame {
    #[serde(default)]
    side_data_list: Vec<std::collections::HashMap<String, serde_json::Value>>,
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
    level: Option<i64>,
    r_frame_rate: Option<String>,
    field_order: Option<String>,
    refs: Option<u32>,
    sample_aspect_ratio: Option<String>,
    sample_rate: Option<String>,
    #[serde(default)]
    tags: std::collections::HashMap<String, String>,
    disposition: Option<std::collections::HashMap<String, i32>>,
    #[serde(default)]
    side_data_list: Vec<std::collections::HashMap<String, serde_json::Value>>,
}

/// Reads a rational like `25/1` as a number.
///
/// ffprobe reports frame rates as a ratio because that is what containers
/// store, and `0/0` for a stream whose rate it could not work out — a still
/// image, or audio. Both are absent rather than zero.
fn parse_rational(value: Option<&String>) -> Option<f64> {
    let text = value?;
    let (numerator, denominator) = text.split_once('/')?;
    let numerator: f64 = numerator.parse().ok()?;
    let denominator: f64 = denominator.parse().ok()?;

    (denominator != 0.0 && numerator != 0.0).then_some(numerator / denominator)
}

/// Whether a field order means the picture is stored as fields.
///
/// ffprobe says `progressive` for whole frames and names the field order
/// otherwise — `tt`, `bb`, `tb`, `bt`. An absent or unknown value is treated as
/// progressive, because that is what almost everything is and guessing the
/// other way would deinterlace material that does not need it.
fn is_interlaced(field_order: Option<&String>) -> bool {
    matches!(
        field_order.map(String::as_str),
        Some("tt" | "bb" | "tb" | "bt")
    )
}

/// The pixel shape, where it is not square.
///
/// ffprobe writes `1:1` for square pixels, and for a stream that never declared
/// one it writes nothing at all. Both mean the picture can be shown at its
/// stored size, so both are absent here.
fn parse_pixel_aspect(value: Option<&String>) -> Option<String> {
    let text = value?.trim();

    (!text.is_empty() && text != "1:1" && text != "0:1").then(|| text.replace(':', "/"))
}

/// How far the picture is rotated for display.
fn rotation_of(stream: &FfprobeStream) -> Option<i32> {
    for side_data in &stream.side_data_list {
        if let Some(rotation) = side_data
            .get("rotation")
            .and_then(serde_json::Value::as_i64)
        {
            return i32::try_from(rotation.abs()).ok();
        }
    }

    stream
        .tags
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("rotate"))
        .and_then(|(_, value)| value.parse::<i32>().ok())
        .map(i32::abs)
}

fn parse_kbps(value: Option<&String>) -> Option<u32> {
    value
        .and_then(|raw| raw.parse::<u64>().ok())
        .map(|bits| u32::try_from(bits / 1000).unwrap_or(u32::MAX))
}

/// What a video stream is graded in, and what is legible underneath it.
struct DetectedRange {
    range: VideoRange,
    base: VideoRange,
}

/// Determines the dynamic range of a video stream.
///
/// Dolby Vision and HDR10+ are carried as side data alongside an ordinary PQ
/// transfer function, so side data is checked before the transfer curve.
/// Reporting HDR10 for a Dolby Vision stream would silently discard the
/// dynamic metadata during transcoding, which is the failure this ordering
/// exists to prevent.
///
/// The two are not carried in the same place. Dolby Vision announces itself in
/// a configuration record on the stream, where a reader of `-show_streams`
/// finds it. **HDR10+ does not**: its SMPTE 2094-40 metadata rides in an SEI
/// message on every frame, so a probe that reads only streams never sees it and
/// falls through to the transfer curve, reporting plain HDR10 for every HDR10+
/// file there is.
///
/// That was the state of this function until a real HDR10+ file was run through
/// it. The test that covered the case passed because it put the metadata at
/// stream level, which is somewhere ffprobe never puts it. Reading the first
/// frame costs a hundredth of a second on a two gigabyte file. See VAL-132.
fn detect_range(stream: &FfprobeStream, frames: &[FfprobeFrame]) -> DetectedRange {
    let stream_side_data = stream.side_data_list.iter();
    let frame_side_data = frames.iter().flat_map(|frame| frame.side_data_list.iter());

    let mut dynamic = None;

    for side_data in stream_side_data.chain(frame_side_data) {
        let kind = side_data
            .get("side_data_type")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();

        if kind.contains("DOVI") || kind.contains("Dolby Vision") {
            return DetectedRange {
                range: VideoRange::DolbyVision,
                base: dolby_vision_base(side_data),
            };
        }

        if kind.contains("HDR Dynamic Metadata") || kind.contains("SMPTE2094") {
            dynamic = Some(VideoRange::Hdr10Plus);
        }
    }

    if let Some(range) = dynamic {
        return DetectedRange {
            range,
            base: VideoRange::Hdr10,
        };
    }

    let range = match stream.color_transfer.as_deref() {
        Some("smpte2084") => VideoRange::Hdr10,
        Some("arib-std-b67") => VideoRange::Hlg,
        _ => VideoRange::Sdr,
    };

    DetectedRange { range, base: range }
}

/// What a player that ignores the Dolby Vision metadata sees in the layer underneath.
///
/// A Dolby Vision stream says for itself what its base layer is gradeable as, in
/// `dv_bl_signal_compatibility_id` on its configuration record. One means the base is HDR10, two
/// means SDR and four means HLG; anything else — profile 5 above all, which is the single-layer
/// IPT-PQ-C2 grade — means nothing but a Dolby Vision decoder can read it, and saying so is what
/// keeps a green and purple picture off a screen that would otherwise have been sent one.
///
/// The value is absent from the RPU side data that rides on frames, which carries no such field, so
/// a file found that way is treated as readable by nothing else. That is the safe way round.
fn dolby_vision_base(side_data: &HashMap<String, serde_json::Value>) -> VideoRange {
    match side_data
        .get("dv_bl_signal_compatibility_id")
        .and_then(serde_json::Value::as_u64)
    {
        Some(1) => VideoRange::Hdr10,
        Some(2) => VideoRange::Sdr,
        Some(4) => VideoRange::Hlg,
        _ => VideoRange::DolbyVision,
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

/// The video stream Valence plays, of however many a file holds.
///
/// The first is the one: a file with two video streams is almost always carrying cover art or a
/// thumbnail alongside the film, and ffprobe lists the real one first.
fn video_stream_of(output: &FfprobeOutput) -> Option<VideoStream> {
    output
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"))
        .map(|stream| {
            let detected = detect_range(stream, &output.frames);

            VideoStream {
                index: stream.index,
                codec: video_codec(stream.codec_name.as_deref().unwrap_or_default()),
                width: stream.width.unwrap_or_default(),
                height: stream.height.unwrap_or_default(),
                range: detected.range,
                range_base: detected.base,
                bitrate_kbps: parse_kbps(stream.bit_rate.as_ref()),
                level: stream
                    .level
                    .filter(|level| *level > 0)
                    .and_then(|level| u32::try_from(level).ok()),
                frame_rate: parse_rational(stream.r_frame_rate.as_ref()),
                is_interlaced: is_interlaced(stream.field_order.as_ref()),
                ref_frames: stream.refs.filter(|refs| *refs > 0),
                pixel_aspect: parse_pixel_aspect(stream.sample_aspect_ratio.as_ref()),
                rotation_degrees: rotation_of(stream),
                bit_depth: stream
                    .bits_per_raw_sample
                    .as_ref()
                    .and_then(|value| value.parse::<u8>().ok())
                    .or_else(|| stream.pix_fmt.as_deref().and_then(bit_depth_from_pix_fmt)),
            }
        })
}

fn to_media_probe(output: &FfprobeOutput, path: &Path) -> MediaProbe {
    let format = output.format.as_ref();

    let video = video_stream_of(output);

    let audio_streams = output
        .streams
        .iter()
        .filter(|stream| stream.codec_type.as_deref() == Some("audio"))
        .map(|stream| AudioStream {
            index: stream.index,
            codec: audio_codec(stream.codec_name.as_deref().unwrap_or_default()),
            channels: stream.channels.unwrap_or(2),
            sample_rate: stream
                .sample_rate
                .as_ref()
                .and_then(|value| value.parse::<u32>().ok()),
            profile: stream
                .profile
                .as_ref()
                .filter(|profile| profile.as_str() != "unknown")
                .cloned(),
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
                title: title_of(stream),
                is_default: is_default(stream),
                is_forced: is_forced(stream),
                is_image_based: is_image_subtitle(format),
            }
        })
        .collect();

    MediaProbe {
        can_copy_segments: None,
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
/// Everything Valence believes about a file comes from here. Nothing is inferred
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
            "-show_frames",
            "-read_intervals",
            "%+#1",
        ])
        .arg(path)
        .kill_on_drop(true)
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

    /// HDR10+ rides on the frames, which is the only place ffprobe reports it.
    ///
    /// This test used to put the metadata in the stream's side data, where it
    /// passed and meant nothing: no real file puts it there, so the branch it
    /// covered could never be reached. Taken from the output of a real HDR10+
    /// file. See VAL-132.
    #[test]
    fn reads_hdr10_plus_from_the_frames_where_ffprobe_reports_it() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084"}],
            "frames": [{"side_data_list": [
                {"side_data_type": "Mastering display metadata"},
                {"side_data_type": "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)"}]}],
            "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(probe.video.expect("has video").range, VideoRange::Hdr10Plus);
    }

    /// A stream carrying both is Dolby Vision, whichever is found first.
    ///
    /// Profile 8.1 is built to be read as HDR10 by players that cannot manage
    /// the RPU, so a file routinely carries a Dolby Vision configuration record
    /// on the stream and HDR10+ metadata on every frame. Taken from a real one.
    #[test]
    fn prefers_dolby_vision_when_a_file_carries_both() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084",
            "side_data_list": [{"side_data_type": "DOVI configuration record"}]}],
            "frames": [{"side_data_list": [
                {"side_data_type": "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)"},
                {"side_data_type": "Dolby Vision RPU Data"}]}],
            "format": {"format_name": "matroska"}}"#;

        let probe = parse_ffprobe_output(json, Path::new("/media/film.mkv")).expect("parses");

        assert_eq!(
            probe.video.expect("has video").range,
            VideoRange::DolbyVision
        );
    }

    /// Profile 8.1 says for itself that its base layer is HDR10, and it is the common case.
    #[test]
    fn reads_the_hdr10_base_of_a_dolby_vision_stream_that_declares_one() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084",
            "side_data_list": [{"side_data_type": "DOVI configuration record",
                "dv_profile": 8, "dv_bl_signal_compatibility_id": 1}]}],
            "format": {"format_name": "mov,mp4"}}"#;

        let video = parse_ffprobe_output(json, Path::new("/media/film.mp4"))
            .expect("parses")
            .video
            .expect("has video");

        assert_eq!(video.range, VideoRange::DolbyVision);
        assert_eq!(video.range_base, VideoRange::Hdr10);
    }

    #[test]
    fn reads_the_sdr_and_hlg_bases_a_dolby_vision_stream_can_also_declare() {
        let with = |id: u64| {
            let json = format!(
                r#"{{"streams": [{{"index": 0, "codec_type": "video", "codec_name": "hevc",
                "side_data_list": [{{"side_data_type": "DOVI configuration record",
                    "dv_bl_signal_compatibility_id": {id}}}]}}],
                "format": {{"format_name": "mov,mp4"}}}}"#
            );

            parse_ffprobe_output(&json, Path::new("/media/film.mp4"))
                .expect("parses")
                .video
                .expect("has video")
                .range_base
        };

        assert_eq!(with(2), VideoRange::Sdr);
        assert_eq!(with(4), VideoRange::Hlg);
    }

    /// Profile 5 is legible to nothing but a Dolby Vision decoder, and sending it anywhere else
    /// shows a green and purple picture rather than a wrong one nobody notices.
    #[test]
    fn leaves_a_dolby_vision_stream_declaring_no_compatible_base_readable_by_nothing_else() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "side_data_list": [{"side_data_type": "DOVI configuration record",
                "dv_profile": 5, "dv_bl_signal_compatibility_id": 0}]}],
            "format": {"format_name": "mov,mp4"}}"#;

        let video = parse_ffprobe_output(json, Path::new("/media/film.mp4"))
            .expect("parses")
            .video
            .expect("has video");

        assert_eq!(video.range_base, VideoRange::DolbyVision);
    }

    /// HDR10+ is HDR10 with per-scene metadata added, so every HDR10 screen already reads it.
    #[test]
    fn reads_the_hdr10_base_underneath_hdr10_plus() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084"}],
            "frames": [{"side_data_list": [
                {"side_data_type": "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)"}]}],
            "format": {"format_name": "matroska"}}"#;

        let video = parse_ffprobe_output(json, Path::new("/media/film.mkv"))
            .expect("parses")
            .video
            .expect("has video");

        assert_eq!(video.range, VideoRange::Hdr10Plus);
        assert_eq!(video.range_base, VideoRange::Hdr10);
    }

    #[test]
    fn leaves_a_stream_with_nothing_to_ignore_reading_as_what_it_is() {
        let json = r#"{"streams": [{"index": 0, "codec_type": "video", "codec_name": "hevc",
            "color_transfer": "smpte2084"}], "format": {"format_name": "matroska"}}"#;

        let video = parse_ffprobe_output(json, Path::new("/media/film.mkv"))
            .expect("parses")
            .video
            .expect("has video");

        assert_eq!(video.range, VideoRange::Hdr10);
        assert_eq!(video.range_base, VideoRange::Hdr10);
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
