use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::transcode_plan::{HardwareAccel, ToneMapping};

/// An encoder Flux may use, and the acceleration it belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EncoderCandidate {
    pub codec: &'static str,
    pub encoder: &'static str,
    pub accel: HardwareAccel,
}

/// Every encoder Flux knows how to drive, hardware first.
///
/// Software encoders are listed last so that a probe result read in order
/// prefers hardware, but each is still verified independently.
pub const ENCODER_CANDIDATES: &[EncoderCandidate] = &[
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_videotoolbox",
        accel: HardwareAccel::VideoToolbox,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_videotoolbox",
        accel: HardwareAccel::VideoToolbox,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_nvenc",
        accel: HardwareAccel::Nvenc,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_nvenc",
        accel: HardwareAccel::Nvenc,
    },
    EncoderCandidate {
        codec: "av1",
        encoder: "av1_nvenc",
        accel: HardwareAccel::Nvenc,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_qsv",
        accel: HardwareAccel::Qsv,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_qsv",
        accel: HardwareAccel::Qsv,
    },
    EncoderCandidate {
        codec: "av1",
        encoder: "av1_qsv",
        accel: HardwareAccel::Qsv,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_vaapi",
        accel: HardwareAccel::Vaapi,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_vaapi",
        accel: HardwareAccel::Vaapi,
    },
    EncoderCandidate {
        codec: "av1",
        encoder: "av1_vaapi",
        accel: HardwareAccel::Vaapi,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_amf",
        accel: HardwareAccel::Amf,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_amf",
        accel: HardwareAccel::Amf,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "h264_rkmpp",
        accel: HardwareAccel::Rkmpp,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "hevc_rkmpp",
        accel: HardwareAccel::Rkmpp,
    },
    EncoderCandidate {
        codec: "h264",
        encoder: "libx264",
        accel: HardwareAccel::None,
    },
    EncoderCandidate {
        codec: "hevc",
        encoder: "libx265",
        accel: HardwareAccel::None,
    },
    EncoderCandidate {
        codec: "av1",
        encoder: "libsvtav1",
        accel: HardwareAccel::None,
    },
    EncoderCandidate {
        codec: "vp9",
        encoder: "libvpx-vp9",
        accel: HardwareAccel::None,
    },
];

/// A verified encoder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedEncoder {
    pub codec: String,
    pub encoder: String,
    pub accel: HardwareAccel,
    /// True when the encoder ran a real frame, false when it is merely listed
    /// by ffmpeg.
    pub verified: bool,
}

/// What this machine can actually do.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub ffmpeg_version: String,
    pub encoders: Vec<VerifiedEncoder>,
    pub hardware_accels: Vec<HardwareAccel>,
    /// How, or whether, this build can convert HDR to SDR.
    pub tone_mapping: ToneMapping,
}

/// Chooses a tone mapping route from the filters a build actually has.
///
/// `libplacebo` is preferred: it does the whole conversion in one filter and
/// handles more source formats. `zscale` is the widely available fallback. A
/// build with neither cannot tone map at all, which callers must surface
/// rather than quietly producing a washed out picture. See ADR-0010.
#[must_use]
pub fn select_tone_mapping(filters: &[String]) -> ToneMapping {
    let has = |name: &str| filters.iter().any(|filter| filter == name);

    if has("libplacebo") {
        return ToneMapping::Libplacebo;
    }

    if has("zscale") && has("tonemap") {
        return ToneMapping::Zscale;
    }

    ToneMapping::Unavailable
}

/// Parses filter names out of `ffmpeg -filters` output.
#[must_use]
pub fn parse_listed_filters(output: &str) -> Vec<String> {
    output
        .lines()
        .skip_while(|line| !line.trim_start().starts_with("------"))
        .filter_map(|line| line.split_whitespace().nth(1))
        .map(str::to_owned)
        .collect()
}

impl Capabilities {
    /// The best available encoder for a codec, hardware preferred.
    #[must_use]
    pub fn best_encoder(&self, codec: &str) -> Option<&VerifiedEncoder> {
        self.encoders
            .iter()
            .find(|encoder| encoder.codec == codec && encoder.accel != HardwareAccel::None)
            .or_else(|| self.encoders.iter().find(|encoder| encoder.codec == codec))
    }

    /// Whether any hardware encoder was verified.
    #[must_use]
    pub fn has_hardware(&self) -> bool {
        self.encoders
            .iter()
            .any(|encoder| encoder.accel != HardwareAccel::None)
    }
}

/// Parses the encoder names out of `ffmpeg -encoders` output.
#[must_use]
pub fn parse_listed_encoders(output: &str) -> Vec<String> {
    output
        .lines()
        .skip_while(|line| !line.trim_start().starts_with("------"))
        .filter_map(|line| line.split_whitespace().nth(1))
        .map(str::to_owned)
        .collect()
}

/// Runs a one frame encode to prove an encoder works.
///
/// Presence in `ffmpeg -encoders` means the binary was built with support, not
/// that the hardware is present, the driver loaded, or the device permitted.
/// A machine that lists `h264_vaapi` with no usable render node will happily
/// report the encoder and then fail every playback attempt, so Flux asks it to
/// encode a frame instead. See ADR-0009.
async fn verify_encoder(ffmpeg: &str, encoder: &str) -> bool {
    Command::new(ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=128x128:rate=1",
            "-frames:v",
            "1",
            "-c:v",
            encoder,
            "-f",
            "null",
            "-",
        ])
        .output()
        .await
        .is_ok_and(|output| output.status.success())
}

async fn read_version(ffmpeg: &str) -> String {
    let Ok(output) = Command::new(ffmpeg).arg("-version").output().await else {
        return "unknown".to_owned();
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("unknown")
        .to_owned()
}

/// Detects what this machine can encode, verifying each candidate by encoding.
pub async fn detect_capabilities(ffmpeg: &str) -> Capabilities {
    let listed = match Command::new(ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .output()
        .await
    {
        Ok(output) => parse_listed_encoders(&String::from_utf8_lossy(&output.stdout)),
        Err(_) => Vec::new(),
    };

    let mut encoders = Vec::new();

    for candidate in ENCODER_CANDIDATES {
        if !listed.iter().any(|name| name == candidate.encoder) {
            continue;
        }

        if !verify_encoder(ffmpeg, candidate.encoder).await {
            continue;
        }

        encoders.push(VerifiedEncoder {
            codec: candidate.codec.to_owned(),
            encoder: candidate.encoder.to_owned(),
            accel: candidate.accel,
            verified: true,
        });
    }

    let mut hardware_accels: Vec<HardwareAccel> = encoders
        .iter()
        .map(|encoder| encoder.accel)
        .filter(|accel| *accel != HardwareAccel::None)
        .collect();

    hardware_accels.dedup();

    let filters = match Command::new(ffmpeg)
        .args(["-hide_banner", "-filters"])
        .output()
        .await
    {
        Ok(output) => parse_listed_filters(&String::from_utf8_lossy(&output.stdout)),
        Err(_) => Vec::new(),
    };

    Capabilities {
        ffmpeg_version: read_version(ffmpeg).await,
        encoders,
        hardware_accels,
        tone_mapping: select_tone_mapping(&filters),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        parse_listed_encoders, parse_listed_filters, select_tone_mapping, Capabilities,
        VerifiedEncoder,
    };
    use crate::transcode_plan::{HardwareAccel, ToneMapping};

    const ENCODERS_OUTPUT: &str = "Encoders:\n V..... = Video\n ------\n V....D libx264              libx264 H.264\n V....D h264_videotoolbox    VideoToolbox H.264\n A....D aac                  AAC\n";

    #[test]
    fn parses_encoder_names_after_the_separator() {
        let names = parse_listed_encoders(ENCODERS_OUTPUT);

        assert!(names.contains(&"libx264".to_owned()));
        assert!(names.contains(&"h264_videotoolbox".to_owned()));
        assert!(names.contains(&"aac".to_owned()));
    }

    #[test]
    fn ignores_the_legend_above_the_separator() {
        let names = parse_listed_encoders(ENCODERS_OUTPUT);

        assert!(!names.iter().any(|name| name == "="));
    }

    fn capabilities(encoders: Vec<VerifiedEncoder>) -> Capabilities {
        Capabilities {
            ffmpeg_version: "test".to_owned(),
            encoders,
            hardware_accels: Vec::new(),
            tone_mapping: ToneMapping::Unavailable,
        }
    }

    #[test]
    fn prefers_libplacebo_for_tone_mapping() {
        let filters = vec![
            "zscale".to_owned(),
            "tonemap".to_owned(),
            "libplacebo".to_owned(),
        ];

        assert_eq!(select_tone_mapping(&filters), ToneMapping::Libplacebo);
    }

    #[test]
    fn falls_back_to_zscale() {
        let filters = vec!["zscale".to_owned(), "tonemap".to_owned()];

        assert_eq!(select_tone_mapping(&filters), ToneMapping::Zscale);
    }

    #[test]
    fn reports_unavailable_when_tonemap_has_no_lineariser() {
        assert_eq!(
            select_tone_mapping(&["tonemap".to_owned()]),
            ToneMapping::Unavailable
        );
    }

    #[test]
    fn reports_unavailable_when_no_filters_exist() {
        assert_eq!(select_tone_mapping(&[]), ToneMapping::Unavailable);
    }

    #[test]
    fn parses_filter_names() {
        let output = "Filters:\n T.. = Timeline\n ------\n ... scale  V->V  Scale\n .S. tonemap V->V  Tone\n";

        let names = parse_listed_filters(output);

        assert!(names.contains(&"scale".to_owned()));
        assert!(names.contains(&"tonemap".to_owned()));
    }

    #[test]
    fn prefers_hardware_over_software_for_the_same_codec() {
        let subject = capabilities(vec![
            VerifiedEncoder {
                codec: "h264".into(),
                encoder: "libx264".into(),
                accel: HardwareAccel::None,
                verified: true,
            },
            VerifiedEncoder {
                codec: "h264".into(),
                encoder: "h264_nvenc".into(),
                accel: HardwareAccel::Nvenc,
                verified: true,
            },
        ]);

        assert_eq!(
            subject.best_encoder("h264").expect("has one").encoder,
            "h264_nvenc"
        );
    }

    #[test]
    fn falls_back_to_software_when_no_hardware_exists() {
        let subject = capabilities(vec![VerifiedEncoder {
            codec: "hevc".into(),
            encoder: "libx265".into(),
            accel: HardwareAccel::None,
            verified: true,
        }]);

        assert_eq!(
            subject.best_encoder("hevc").expect("has one").encoder,
            "libx265"
        );
    }

    #[test]
    fn reports_nothing_for_an_unavailable_codec() {
        assert!(capabilities(Vec::new()).best_encoder("av1").is_none());
    }

    #[test]
    fn reports_whether_any_hardware_was_verified() {
        assert!(!capabilities(vec![VerifiedEncoder {
            codec: "h264".into(),
            encoder: "libx264".into(),
            accel: HardwareAccel::None,
            verified: true,
        }])
        .has_hardware());
    }
}
