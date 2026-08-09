use serde::{Deserialize, Serialize};

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

/// What should happen to the video stream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VideoAction {
    Copy,
    Encode {
        codec: String,
        max_bitrate_kbps: u32,
        max_width: u32,
        max_height: u32,
    },
}

/// What should happen to the audio stream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AudioAction {
    Copy,
    Encode {
        codec: String,
        channels: u8,
        max_bitrate_kbps: u32,
    },
}

/// A fully resolved transcode instruction.
///
/// The `FFmpeg` command line is always built from this struct and never
/// assembled from strings at call sites, so that invocations are
/// deterministic, unit testable without spawning a process, and loggable in
/// full for support. See ADR-0009.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscodePlan {
    pub input_path: String,
    pub output_path: String,
    pub hardware_accel: HardwareAccel,
    pub video: VideoAction,
    pub audio: AudioAction,
}

impl TranscodePlan {
    /// Builds the `FFmpeg` argument vector for this plan.
    #[must_use]
    pub fn to_ffmpeg_args(&self) -> Vec<String> {
        let mut args: Vec<String> = vec!["-hide_banner".into(), "-nostdin".into()];

        if let Some(flag) = self.hardware_accel.ffmpeg_flag() {
            args.push("-hwaccel".into());
            args.push(flag.into());
        }

        args.push("-i".into());
        args.push(self.input_path.clone());

        match &self.video {
            VideoAction::Copy => {
                args.push("-c:v".into());
                args.push("copy".into());
            }
            VideoAction::Encode {
                codec,
                max_bitrate_kbps,
                max_width,
                max_height,
            } => {
                args.push("-c:v".into());
                args.push(codec.clone());
                args.push("-b:v".into());
                args.push(format!("{max_bitrate_kbps}k"));
                args.push("-vf".into());
                args.push(format!(
                    "scale=w={max_width}:h={max_height}:force_original_aspect_ratio=decrease"
                ));
            }
        }

        match &self.audio {
            AudioAction::Copy => {
                args.push("-c:a".into());
                args.push("copy".into());
            }
            AudioAction::Encode {
                codec,
                channels,
                max_bitrate_kbps,
            } => {
                args.push("-c:a".into());
                args.push(codec.clone());
                args.push("-ac".into());
                args.push(channels.to_string());
                args.push("-b:a".into());
                args.push(format!("{max_bitrate_kbps}k"));
            }
        }

        args.push(self.output_path.clone());

        args
    }
}

#[cfg(test)]
mod tests {
    use super::{AudioAction, HardwareAccel, TranscodePlan, VideoAction};

    fn plan(video: VideoAction, audio: AudioAction, accel: HardwareAccel) -> TranscodePlan {
        TranscodePlan {
            input_path: "/media/film.mkv".into(),
            output_path: "/transcodes/out.m3u8".into(),
            hardware_accel: accel,
            video,
            audio,
        }
    }

    #[test]
    fn copies_both_streams_when_nothing_needs_encoding() {
        let args = plan(VideoAction::Copy, AudioAction::Copy, HardwareAccel::None).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-c:v", "copy"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn omits_hwaccel_flag_when_none() {
        let args = plan(VideoAction::Copy, AudioAction::Copy, HardwareAccel::None).to_ffmpeg_args();

        assert!(!args.iter().any(|a| a == "-hwaccel"));
    }

    #[test]
    fn includes_hwaccel_flag_when_available() {
        let args =
            plan(VideoAction::Copy, AudioAction::Copy, HardwareAccel::Vaapi).to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-hwaccel", "vaapi"]));
    }

    #[test]
    fn copies_audio_when_only_video_is_encoded() {
        let args = plan(
            VideoAction::Encode {
                codec: "h264_vaapi".into(),
                max_bitrate_kbps: 8000,
                max_width: 1920,
                max_height: 1080,
            },
            AudioAction::Copy,
            HardwareAccel::Vaapi,
        )
        .to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-c:v", "h264_vaapi"]));
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn copies_video_when_only_audio_is_encoded() {
        let args = plan(
            VideoAction::Copy,
            AudioAction::Encode {
                codec: "aac".into(),
                channels: 2,
                max_bitrate_kbps: 256,
            },
            HardwareAccel::None,
        )
        .to_ffmpeg_args();

        assert!(args.windows(2).any(|w| w == ["-c:v", "copy"]));
        assert!(args.windows(2).any(|w| w == ["-ac", "2"]));
    }

    #[test]
    fn places_input_before_output() {
        let args = plan(VideoAction::Copy, AudioAction::Copy, HardwareAccel::None).to_ffmpeg_args();

        let input = args.iter().position(|a| a == "/media/film.mkv");
        let output = args.iter().position(|a| a == "/transcodes/out.m3u8");

        assert!(input < output);
    }

    #[test]
    fn is_deterministic() {
        let subject = plan(VideoAction::Copy, AudioAction::Copy, HardwareAccel::Qsv);

        assert_eq!(subject.to_ffmpeg_args(), subject.to_ffmpeg_args());
    }
}
