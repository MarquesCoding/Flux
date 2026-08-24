use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::transcode_plan::{HardwareAccel, ToneMapping};

/// An encoder Valence may use, and the acceleration it belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EncoderCandidate {
    pub codec: &'static str,
    pub encoder: &'static str,
    pub accel: HardwareAccel,
}

/// Every encoder Valence knows how to drive, hardware first.
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

/// An encoder Valence knows how to drive but this machine would not run.
///
/// Kept rather than discarded, because the two worst faults in the hardware
/// acceleration work were both encoders silently dropped for a reason that had
/// nothing to do with the card: a probe too small for NVENC, and a probe with
/// no device for VAAPI. Both were invisible for as long as rejection was a
/// bare `false`. An operator who can read "no VA display found for
/// /dev/dri/renderD128" can fix it in a minute.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectedEncoder {
    pub codec: String,
    pub encoder: String,
    pub accel: HardwareAccel,
    /// What ffmpeg said, trimmed to the part worth reading.
    pub reason: String,
}

/// The last line of ffmpeg's complaint, which is usually the useful one.
///
/// A failed encoder open prints a paragraph of context and then the actual
/// problem. Keeping all of it makes the admin page unreadable; keeping the
/// first line usually keeps "Error while opening encoder" and throws away the
/// reason.
///
/// `fallback` stands in when ffmpeg failed without saying anything, and belongs
/// to the caller: the same silence means different things when an encoder would
/// not open and when a finished file would not decode.
#[must_use]
pub fn summarise_failure(stderr: &str, fallback: &str) -> String {
    const LIMIT: usize = 200;

    let last = stderr
        .lines()
        .map(str::trim)
        .rfind(|line| !line.is_empty())
        .unwrap_or(fallback);

    if last.chars().count() <= LIMIT {
        return last.to_owned();
    }

    last.chars().take(LIMIT).collect()
}

/// What this machine can actually do.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub ffmpeg_version: String,
    /// What this build decides about a file when it probes it.
    ///
    /// Reported here because the rules are the transcoder's, so the number that
    /// tracks them has to be too. The library stores it beside each row and
    /// probes again wherever it does not match. See [`crate::probe::PROBE_VERSION`].
    #[serde(default)]
    pub probe_version: u32,
    /// Whether that version is one Valence will vouch for.
    ///
    /// Reported rather than enforced. An older build mostly works, and refusing
    /// to start would be a worse answer than saying so plainly — but it loses
    /// filters that decide whether frames stay on the hardware, and that is
    /// invisible from the outside. See [`MINIMUM_FFMPEG`].
    #[serde(default = "assume_supported")]
    pub ffmpeg_supported: bool,
    pub encoders: Vec<VerifiedEncoder>,
    pub hardware_accels: Vec<HardwareAccel>,
    /// How, or whether, this build can convert HDR to SDR.
    pub tone_mapping: ToneMapping,
    /// Whether text subtitles can be drawn onto frames.
    ///
    /// Needs the `subtitles` filter, which needs libass. Bitmap subtitles use
    /// `overlay` instead and are reported separately, because a build can
    /// manage one and not the other.
    pub can_burn_text_subtitles: bool,
    pub can_burn_image_subtitles: bool,
    /// Encoders that were offered and would not run, and what they said.
    #[serde(default)]
    pub rejected: Vec<RejectedEncoder>,
    /// The hardware scalers this build actually has.
    ///
    /// A backend can only keep frames on the device end to end if the scaler
    /// for its frames is compiled in. `scale_vt` arrived in `FFmpeg` 7.0, and
    /// some builds ship `scale_npp` instead of `scale_cuda`, so the filter
    /// Valence needs is a property of the binary rather than of the hardware.
    /// Assuming it is there means a chain that fails and quietly falls back to
    /// software, losing most of the point of the acceleration.
    #[serde(default)]
    pub hardware_scalers: Vec<String>,
    /// The hardware compositors this build actually has.
    ///
    /// What lets subtitles be burned in without bringing the video down: the
    /// overlay is built as its own small stream, uploaded, and drawn on the
    /// device. Probed separately from the scaler because having one does not
    /// imply the other — `overlay_videotoolbox` is a flux-ffmpeg patch rather
    /// than an upstream filter, so a stock build has `scale_vt` and no
    /// compositor to go with it.
    #[serde(default)]
    pub hardware_overlays: Vec<String>,
    /// The hardware tone mappers this machine will actually run.
    ///
    /// Converting HDR to SDR is the most expensive thing Valence asks of a frame,
    /// and doing it in software costs the hardware decode and scale as well,
    /// because the conversion has to happen before the picture is resampled.
    /// A backend with its own tone mapper avoids all of that.
    ///
    /// Verified by running one, not by finding it in `ffmpeg -filters`.
    /// `tonemap_vaapi` is VPP tone mapping, which Intel implements and AMD does
    /// not, so a Radeon lists the filter and refuses the chain. Presence was
    /// what this asked at first, and an RX 580 failed every HDR transcode as a
    /// result. See VAL-111.
    #[serde(default)]
    pub hardware_tone_maps: Vec<String>,
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
///
/// Unlike `-encoders`, this listing has no `------` separator: the legend runs
/// straight into the filters. A filter row is recognised by its third column
/// describing the signature, as in `V->V`, which no legend line has.
#[must_use]
pub fn parse_listed_filters(output: &str) -> Vec<String> {
    output
        .lines()
        .filter_map(|line| {
            let mut columns = line.split_whitespace();
            let _flags = columns.next()?;
            let name = columns.next()?;
            let signature = columns.next()?;

            signature.contains("->").then(|| name.to_owned())
        })
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

/// Every hardware scaler Valence might ask for.
///
/// Checked against the build rather than assumed, because which of these exist
/// depends on how `FFmpeg` was compiled and on its version: `scale_vt` arrived
/// in 7.0, and some builds ship `scale_npp` in place of `scale_cuda`.
pub const HARDWARE_SCALERS: [&str; 4] = ["scale_vt", "scale_cuda", "vpp_qsv", "scale_vaapi"];

/// Every hardware compositor Valence might ask for.
///
/// Verified against the shipped arm64 package, which has `overlay_vaapi`,
/// `overlay_cuda`, `overlay_opencl`, `overlay_vulkan` and `overlay_rkrga`.
/// `overlay_qsv` is absent there because QSV is not built for arm, and it is
/// listed so a build that does have it is not left on the software path.
///
/// `overlay_videotoolbox` was absent for the same reason until VAL-110, which
/// was that no macOS package existed. The Apple silicon build has it, and it
/// was measured compositing rather than merely listed.
pub const HARDWARE_OVERLAYS: [&str; 5] = [
    "overlay_videotoolbox",
    "overlay_cuda",
    "overlay_qsv",
    "overlay_vaapi",
    "overlay_rkrga",
];

/// The smallest picture the encoders Valence drives are known to accept.
///
///
/// NVENC's H.264 minimum, which is the largest of them. A probe below this
/// measures an encoder's tolerance for tiny pictures rather than whether the
/// driver is there, which is the only thing it is meant to find out.
pub const SMALLEST_USABLE_PROBE: (u32, u32) = (145, 49);

/// How big a picture the probe asks for.
///
/// This was 128x128, which is under NVENC's floor, so **every NVIDIA card ever
/// tested failed verification** — and unlike Intel, where `h264_qsv` sits ahead
/// of VAAPI in the candidate list and rescues the machine, nothing sits behind
/// NVENC. Those hosts dropped to `libx264` and stayed there.
///
/// Measured on an RTX 5080 with Debian's ffmpeg 5.1.9: `h264_nvenc` fails at
/// 128x128, verifies at 320x240, and drives a full decode-scale-encode chain
/// either way. The card was never the problem.
///
/// 640x480 leaves room for whatever the next backend's floor turns out to be.
/// It is one frame, so the headroom costs nothing worth counting.
const PROBE_SIZE: (u32, u32) = (640, 480);

/// The arguments that ask an encoder to prove itself.
///
/// Separated from running them so the size can be held to
/// [`SMALLEST_USABLE_PROBE`] by a test rather than by whoever reads it next.
///
/// A backend that needs a device is given one, and the frames are uploaded to
/// it. Without that, `h264_vaapi` cannot open at all and the probe reports a
/// working card as broken. Measured on an RX 580 whose driver was demonstrably
/// healthy: every VAAPI encoder failed without a device and passed with one.
#[must_use]
pub fn probe_arguments(candidate: &EncoderCandidate, device: &str) -> Vec<String> {
    let (width, height) = PROBE_SIZE;
    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
    ];

    if candidate.accel.needs_device_to_probe() {
        arguments.extend(candidate.accel.device_arguments(device));
    }

    arguments.extend([
        "-f".to_owned(),
        "lavfi".to_owned(),
        "-i".to_owned(),
        format!("testsrc2=size={width}x{height}:rate=1"),
        "-frames:v".to_owned(),
        "1".to_owned(),
    ]);

    if candidate.accel.needs_uploaded_frames() {
        arguments.push("-vf".to_owned());
        arguments.push("format=nv12,hwupload".to_owned());
    }

    arguments.extend([
        "-c:v".to_owned(),
        candidate.encoder.to_owned(),
        "-f".to_owned(),
        "null".to_owned(),
        "-".to_owned(),
    ]);

    arguments
}

/// What a probe frame has to claim to be for a tone mapper to accept it.
///
/// Ten bits is not enough on its own. `testsrc2` carries no colour properties,
/// so a tone mapper is handed a frame whose transfer function is `unknown` —
/// and `tonemap_videotoolbox` refuses that outright rather than passing it
/// through: "No DOVI metadata and unsupported transfer function
/// characteristic". Measured on Apple silicon against the VAL-110 build.
///
/// So the probe says what the frame is. PQ on BT.2020 is the HDR a tone mapper
/// exists to convert, which makes this the honest question to ask rather than a
/// concession to one filter.
const PROBE_HDR_PARAMETERS: &str =
    "setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc";

/// The arguments that ask a tone mapper to prove itself.
///
/// Ten-bit frames, because that is what a tone mapper is for and what the
/// hardware paths are specialised on. Uploaded to the device, since these
/// filters work on device surfaces and nothing else.
#[must_use]
pub fn tone_map_probe_arguments(accel: HardwareAccel, filter: &str, device: &str) -> Vec<String> {
    let (width, height) = PROBE_SIZE;
    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
    ];

    arguments.extend(accel.filter_device_arguments(device));
    arguments.extend([
        "-f".to_owned(),
        "lavfi".to_owned(),
        "-i".to_owned(),
        format!("testsrc2=size={width}x{height}:rate=1"),
        "-frames:v".to_owned(),
        "1".to_owned(),
        "-vf".to_owned(),
        format!("format=p010,{PROBE_HDR_PARAMETERS},hwupload,{filter}"),
        "-f".to_owned(),
        "null".to_owned(),
        "-".to_owned(),
    ]);

    arguments
}

/// Runs a one frame conversion to prove a tone mapper works.
///
/// The filter being compiled in is not the question. `tonemap_vaapi` is VPP
/// tone mapping, which **Intel implements and AMD does not** — Jellyfin gates
/// its own use of the filter behind a check named `IsIntelVppTonemapAvailable`,
/// and comments its `OpenCL` fallback as Intel-only interop. A Polaris card
/// therefore lists the filter and fails every HDR transcode that uses it.
///
/// Measured on an RX 580 with Mesa 26.0.8: the filter is present and the chain
/// does not run. Presence was what this originally asked, which is the same
/// mistake `verify_encoder` exists to avoid — see VAL-85, and VAL-111 for
/// this instance of it.
async fn verify_tone_map(ffmpeg: &str, accel: HardwareAccel, filter: &str, device: &str) -> bool {
    let Ok(outcome) = Command::new(ffmpeg)
        .args(tone_map_probe_arguments(accel, filter, device))
        .output()
        .await
    else {
        return false;
    };

    outcome.status.success()
}

/// Every tone mapper this build has *and* this machine will run.
///
/// Two gates, and the second is the one that matters: a filter can be compiled
/// in and still be refused by the driver underneath it. Only backends with a
/// tone mapper of their own are asked, which is what keeps this to a few short
/// probes rather than a sweep — and only one of the three can be present on any
/// given machine.
async fn verified_tone_maps(ffmpeg: &str, filters: &[String], device: &str) -> Vec<String> {
    let mut verified = Vec::new();

    for accel in [
        HardwareAccel::Vaapi,
        HardwareAccel::Nvenc,
        HardwareAccel::VideoToolbox,
    ] {
        let Some(mapper) = accel.pipeline().and_then(|pipeline| pipeline.tone_map) else {
            continue;
        };

        let name = crate::transcode_plan::filter_name(mapper);

        if !filters.iter().any(|filter| filter == name) {
            continue;
        }

        if verify_tone_map(ffmpeg, accel, mapper, device).await {
            verified.push(name.to_owned());
        }
    }

    verified
}

/// Runs a one frame encode to prove an encoder works.
///
/// Presence in `ffmpeg -encoders` means the binary was built with support, not
/// that the hardware is present, the driver loaded, or the device permitted.
/// A machine that lists `h264_vaapi` with no usable render node will happily
/// report the encoder and then fail every playback attempt, so Valence asks it to
/// encode a frame instead. See ADR-0009.
///
/// The frame has to be big enough for the encoder to entertain it, which is
/// what [`PROBE_SIZE`] is about, and a backend that wants a device has to be
/// handed one, which is what `device` is about.
async fn verify_encoder(
    ffmpeg: &str,
    candidate: &EncoderCandidate,
    device: &str,
) -> Result<(), String> {
    let outcome = Command::new(ffmpeg)
        .args(probe_arguments(candidate, device))
        .output()
        .await
        .map_err(|error| format!("could not start ffmpeg: {error}"))?;

    if outcome.status.success() {
        return Ok(());
    }

    Err(summarise_failure(
        &String::from_utf8_lossy(&outcome.stderr),
        "the encoder would not open, and said nothing about why",
    ))
}

/// What a payload with no such field meant, which is that nobody had checked.
const fn assume_supported() -> bool {
    true
}

/// The oldest `FFmpeg` Valence will vouch for.
///
/// 7.0 is where `scale_vt` arrived. A build older than that loses the zero-copy
/// path on Apple hardware without failing: frames come back to system memory for
/// the scale, everything still works, and the machine simply does several times
/// the work for the same output. Silence is the problem — an operator has no way
/// to tell that from a slow computer.
pub const MINIMUM_FFMPEG: (u32, u32) = (7, 0);

/// What `--extra-version` stamps into a banner we built.
///
/// Both names, because the binaries already fetched and already inside
/// containers say `-Valence` and will go on saying it until they are rebuilt.
/// Matching only the new one would quietly call every existing build a
/// stranger.
const OUR_BUILDS: [&str; 2] = ["-Flux", "-Valence"];

/// Says which `FFmpeg` the service resolved, and whether it is the one Valence ships.
///
/// Worth a line at startup because the alternative is silence. Falling back to
/// whatever is on `PATH` keeps working and loses the filters that hold frames on
/// the device, so the cost is real, invisible, and looks exactly like a slow
/// machine. An operator reading one line can tell the two apart.
///
/// @param ffmpeg - The path the service resolved.
/// @param banner - The first line of `ffmpeg -version`.
#[must_use]
pub fn describe_build(ffmpeg: &str, banner: &str) -> String {
    let version = banner
        .split_whitespace()
        .nth(2)
        .filter(|_| banner.starts_with("ffmpeg version"))
        .unwrap_or("an unreadable version");

    if OUR_BUILDS.iter().any(|name| banner.contains(name)) {
        return format!("using Valence's own ffmpeg at {ffmpeg}, which reports {version}");
    }

    format!(
        "using {ffmpeg}, which reports {version} and is not the build Valence ships — \
         the filters that keep subtitles and HDR on the device are likely missing"
    )
}

/// The major and minor version out of an ffmpeg banner.
///
/// Builds label themselves freely — Debian appends `-0+deb12u1`, Jellyfin
/// appends `-Jellyfin`, a git build may say `n7.1-dev`. So this reads the digits
/// and stops at the first thing that is not one, rather than trying to
/// understand the rest.
#[must_use]
pub fn version_numbers(banner: &str) -> Option<(u32, u32)> {
    let digits = banner.split_whitespace().find_map(|word| {
        let candidate = word.trim_start_matches('n');

        candidate
            .starts_with(|first: char| first.is_ascii_digit())
            .then_some(candidate)
    })?;

    let mut parts = digits.split(['.', '-', '_']);

    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);

    Some((major, minor))
}

/// Whether a build is one Valence will vouch for.
///
/// An unreadable version is treated as supported. Refusing to work because a
/// banner could not be parsed would be worse than the thing being guarded
/// against, and a build too old to name itself clearly is rare next to a build
/// that simply labels itself in a way nobody anticipated.
#[must_use]
pub fn meets_minimum(banner: &str) -> bool {
    version_numbers(banner).is_none_or(|found| found >= MINIMUM_FFMPEG)
}

/// The first line of what `FFmpeg` says about itself, or "unknown".
pub async fn read_version(ffmpeg: &str) -> String {
    let Ok(output) = Command::new(ffmpeg).arg("-version").output().await else {
        return "unknown".to_owned();
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("unknown")
        .to_owned()
}

/// Cached across every call for the life of the process.
///
/// What a machine can encode does not change between one request and the
/// next, but detecting it verifies each candidate by actually running it
/// through `FFmpeg` — a handful of process spawns that make every admin page
/// load feel slow if repeated on every request. There is exactly one `FFmpeg`
/// binary configured for the process's whole life, so a single cache is
/// correct regardless of how many callers ask.
static CACHE: tokio::sync::OnceCell<Capabilities> = tokio::sync::OnceCell::const_new();

/// Detects what this machine can encode, verifying each candidate by encoding.
///
/// Only actually runs the detection once; every call after the first reuses
/// the cached result. See `CACHE`.
pub async fn detect_capabilities(ffmpeg: &str, device: &str) -> Capabilities {
    CACHE
        .get_or_init(|| detect_capabilities_uncached(ffmpeg, device))
        .await
        .clone()
}

async fn detect_capabilities_uncached(ffmpeg: &str, device: &str) -> Capabilities {
    let listed = match Command::new(ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .output()
        .await
    {
        Ok(output) => parse_listed_encoders(&String::from_utf8_lossy(&output.stdout)),
        Err(_) => Vec::new(),
    };

    let mut encoders = Vec::new();
    let mut rejected = Vec::new();

    for candidate in ENCODER_CANDIDATES {
        if !listed.iter().any(|name| name == candidate.encoder) {
            continue;
        }

        match verify_encoder(ffmpeg, candidate, device).await {
            Ok(()) => encoders.push(VerifiedEncoder {
                codec: candidate.codec.to_owned(),
                encoder: candidate.encoder.to_owned(),
                accel: candidate.accel,
                verified: true,
            }),
            Err(reason) => {
                eprintln!("capability: {} rejected — {reason}", candidate.encoder);

                rejected.push(RejectedEncoder {
                    codec: candidate.codec.to_owned(),
                    encoder: candidate.encoder.to_owned(),
                    accel: candidate.accel,
                    reason,
                });
            }
        }
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

    let version = read_version(ffmpeg).await;

    Capabilities {
        ffmpeg_supported: meets_minimum(&version),
        ffmpeg_version: version,
        probe_version: crate::probe::PROBE_VERSION,
        encoders,
        hardware_accels,
        tone_mapping: select_tone_mapping(&filters),
        hardware_scalers: HARDWARE_SCALERS
            .iter()
            .filter(|scaler| filters.iter().any(|filter| filter == *scaler))
            .map(|scaler| (*scaler).to_owned())
            .collect(),
        hardware_overlays: HARDWARE_OVERLAYS
            .iter()
            .filter(|overlay| filters.iter().any(|filter| filter == *overlay))
            .map(|overlay| (*overlay).to_owned())
            .collect(),
        hardware_tone_maps: verified_tone_maps(ffmpeg, &filters, device).await,
        rejected,
        can_burn_text_subtitles: filters.iter().any(|filter| filter == "subtitles"),
        can_burn_image_subtitles: filters.iter().any(|filter| filter == "overlay"),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        describe_build, parse_listed_encoders, parse_listed_filters, probe_arguments,
        select_tone_mapping, tone_map_probe_arguments, Capabilities, EncoderCandidate,
        VerifiedEncoder, ENCODER_CANDIDATES, SMALLEST_USABLE_PROBE,
    };
    use crate::transcode_plan::HardwareAccel;
    use crate::transcode_plan::DEFAULT_DEVICE;

    /// The probe has to ask for the thing tone mapping is for.
    ///
    /// Eight-bit frames would let a driver that cannot convert HDR pass, which
    /// is the whole failure this probe exists to catch.
    #[test]
    fn asks_a_tone_mapper_for_ten_bit_frames_on_the_device() {
        let arguments = tone_map_probe_arguments(
            HardwareAccel::Vaapi,
            "tonemap_vaapi=format=nv12:p=bt709:t=bt709:m=bt709",
            DEFAULT_DEVICE,
        );

        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("the probe names a filter chain");

        assert!(chain.starts_with("format=p010,"), "{chain}");
        assert!(chain.contains(",hwupload,"), "{chain}");
        assert!(chain.contains("tonemap_vaapi"), "{chain}");
    }

    /// An untagged frame is not HDR, and a tone mapper is entitled to say so.
    ///
    /// `testsrc2` carries no transfer function, and `tonemap_videotoolbox`
    /// rejects that rather than passing it through — so without this the probe
    /// would report a working filter as broken and every HDR session on a Mac
    /// would convert in software for no reason.
    #[test]
    fn tells_a_tone_mapper_the_probe_frame_is_hdr() {
        let arguments = tone_map_probe_arguments(
            HardwareAccel::VideoToolbox,
            "tonemap_videotoolbox",
            DEFAULT_DEVICE,
        );

        let chain = arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("the probe names a filter chain");

        assert!(chain.contains("color_trc=smpte2084"), "{chain}");
        assert!(chain.contains("color_primaries=bt2020"), "{chain}");
    }

    /// The backends that find their own device still need one to be probed.
    ///
    /// A session gets its device from the decoder. A probe has no decoder, so
    /// `hwupload` has nothing to derive from and the chain will not configure —
    /// measured on Apple silicon and again on an RTX 5080, where `tonemap_cuda`
    /// failed with the same "hardware device reference is required" as
    /// `tonemap_videotoolbox`. That is why `tonemap_cuda` had never verified.
    ///
    /// The second assertion is the one that matters most: a transcode must keep
    /// taking its device from the decoder, because naming a second one risks
    /// `hwupload` filling a pool the decoder does not share.
    #[test]
    fn gives_the_probe_a_device_the_transcode_would_not_need() {
        for (accel, filter, expected) in [
            (
                HardwareAccel::VideoToolbox,
                "tonemap_videotoolbox",
                "videotoolbox=vt",
            ),
            (HardwareAccel::Nvenc, "tonemap_cuda", "cuda=cu"),
        ] {
            let arguments = tone_map_probe_arguments(accel, filter, DEFAULT_DEVICE);

            assert!(
                arguments.iter().any(|argument| argument == expected),
                "{accel:?} probe needs a device: {arguments:?}"
            );
            assert!(
                accel.device_arguments(DEFAULT_DEVICE).is_empty(),
                "{accel:?} must not name a second device to transcode"
            );
        }
    }

    /// A tone mapper works on device surfaces, so the probe needs a device.
    ///
    /// Without one the filter cannot open and a healthy Intel machine would
    /// report itself unable to convert HDR — the same fault that made every
    /// VAAPI encoder look broken before VAL-80.
    #[test]
    fn gives_a_tone_mapper_probe_the_device_it_needs() {
        let arguments =
            tone_map_probe_arguments(HardwareAccel::Vaapi, "tonemap_vaapi", DEFAULT_DEVICE);

        assert!(
            arguments
                .iter()
                .any(|argument| argument.contains(DEFAULT_DEVICE)),
            "{arguments:?}"
        );
    }

    fn candidate(encoder: &'static str, accel: HardwareAccel) -> EncoderCandidate {
        EncoderCandidate {
            codec: "h264",
            encoder,
            accel,
        }
    }

    fn probe_size() -> (u32, u32) {
        let arguments = probe_arguments(
            &candidate("h264_nvenc", HardwareAccel::Nvenc),
            DEFAULT_DEVICE,
        );
        let source = arguments
            .iter()
            .find(|argument| argument.starts_with("testsrc2="))
            .expect("the probe names a source");

        let size = source
            .split("size=")
            .nth(1)
            .and_then(|rest| rest.split(':').next())
            .expect("the source states a size");

        let mut parts = size.split('x');
        let width = parts.next().and_then(|part| part.parse().ok());
        let height = parts.next().and_then(|part| part.parse().ok());

        (width.expect("a width"), height.expect("a height"))
    }

    #[test]
    fn probes_a_picture_every_encoder_will_accept() {
        let (width, height) = probe_size();
        let (least_width, least_height) = SMALLEST_USABLE_PROBE;

        assert!(
            width >= least_width && height >= least_height,
            "a {width}x{height} probe is below NVENC's {least_width}x{least_height} floor, \
             which fails every NVIDIA card for a reason that is not about the card"
        );
    }

    #[test]
    fn hands_vaapi_a_device_and_uploads_the_frame_to_it() {
        let arguments = probe_arguments(
            &candidate("h264_vaapi", HardwareAccel::Vaapi),
            "/dev/dri/renderD128",
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-init_hw_device", "vaapi=va:/dev/dri/renderD128"]));
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-vf", "format=nv12,hwupload"]));
    }

    #[test]
    fn leaves_qsv_to_find_its_own_device_when_probing() {
        let arguments = probe_arguments(
            &candidate("h264_qsv", HardwareAccel::Qsv),
            "/dev/dri/renderD128",
        );

        assert!(
            !arguments
                .iter()
                .any(|argument| argument == "-init_hw_device"),
            "QSV verifies unaided; forcing a guessed node would reject a card on renderD129"
        );
    }

    #[test]
    fn asks_for_no_device_where_none_is_wanted() {
        for accel in [
            HardwareAccel::Nvenc,
            HardwareAccel::VideoToolbox,
            HardwareAccel::Qsv,
            HardwareAccel::None,
        ] {
            let arguments = probe_arguments(&candidate("enc", accel), DEFAULT_DEVICE);

            assert!(
                !arguments
                    .iter()
                    .any(|argument| argument == "-init_hw_device"),
                "{accel:?} opens its own device"
            );
            assert!(
                !arguments.iter().any(|argument| argument == "-vf"),
                "{accel:?} takes a software frame as it comes"
            );
        }
    }

    #[test]
    fn probes_the_device_it_was_given() {
        let arguments = probe_arguments(
            &candidate("h264_vaapi", HardwareAccel::Vaapi),
            "/dev/dri/renderD129",
        );

        assert!(arguments
            .iter()
            .any(|argument| argument == "vaapi=va:/dev/dri/renderD129"));
    }

    #[test]
    fn probes_the_encoder_it_was_asked_about() {
        let arguments = probe_arguments(&candidate("hevc_qsv", HardwareAccel::Qsv), DEFAULT_DEVICE);

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "hevc_qsv"]));
    }

    #[test]
    fn probes_one_frame_and_writes_nothing() {
        let arguments = probe_arguments(
            &candidate("h264_vaapi", HardwareAccel::Vaapi),
            DEFAULT_DEVICE,
        );

        assert!(arguments.windows(2).any(|pair| pair == ["-frames:v", "1"]));
        assert!(arguments.windows(2).any(|pair| pair == ["-f", "null"]));
    }

    #[test]
    fn drops_no_candidate_for_being_unnamed() {
        for candidate in ENCODER_CANDIDATES {
            let arguments = probe_arguments(candidate, DEFAULT_DEVICE);

            assert!(
                arguments
                    .iter()
                    .any(|argument| argument == candidate.encoder),
                "{} is never actually probed",
                candidate.encoder
            );
        }
    }
    use crate::transcode_plan::ToneMapping;

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

    /// The startup line has to distinguish the two builds, or it is decoration.
    ///
    /// Falling back to `PATH` is silent and costs the device paths, so a line
    /// that says the same thing either way would leave the fault exactly as
    /// hidden as it was. See VAL-110.
    #[test]
    fn says_when_the_build_is_our_own() {
        let notice = describe_build(
            "/repo/.ffmpeg/ffmpeg",
            "ffmpeg version 8.1.2-Valence Copyright (c) 2000-2026 the FFmpeg developers",
        );

        assert!(notice.contains("Valence's own ffmpeg"), "{notice}");
        assert!(notice.contains("/repo/.ffmpeg/ffmpeg"), "{notice}");
        assert!(notice.contains("8.1.2-Valence"), "{notice}");
    }

    /// The shipped build still labels itself `-Flux`, so the rename must not
    /// stop the service recognising the very ffmpeg it installs. See VAL-183.
    #[test]
    fn still_knows_the_build_that_kept_its_old_name() {
        let notice = describe_build(
            "/repo/.ffmpeg/ffmpeg",
            "ffmpeg version 8.1.2-Flux Copyright (c) 2000-2026 the FFmpeg developers",
        );

        assert!(notice.contains("Valence's own ffmpeg"), "{notice}");
        assert!(notice.contains("8.1.2-Flux"), "{notice}");
    }

    #[test]
    fn warns_when_the_build_is_not_our_own() {
        let notice = describe_build(
            "/opt/homebrew/bin/ffmpeg",
            "ffmpeg version 8.1.2 Copyright (c) 2000-2026 the FFmpeg developers",
        );

        assert!(notice.contains("not the build Valence ships"), "{notice}");
        assert!(notice.contains("/opt/homebrew/bin/ffmpeg"), "{notice}");
    }

    #[test]
    fn does_not_mistake_another_fork_for_ours() {
        let notice = describe_build(
            "/usr/lib/jellyfin-ffmpeg/ffmpeg",
            "ffmpeg version 8.1.2-Jellyfin Copyright (c) 2000-2026",
        );

        assert!(notice.contains("not the build Valence ships"), "{notice}");
    }

    #[test]
    fn still_names_the_path_when_ffmpeg_said_nothing_readable() {
        let notice = describe_build("/nowhere/ffmpeg", "unknown");

        assert!(notice.contains("/nowhere/ffmpeg"), "{notice}");
        assert!(notice.contains("an unreadable version"), "{notice}");
    }

    #[test]
    fn reads_the_version_out_of_a_plain_banner() {
        assert_eq!(
            super::version_numbers("ffmpeg version 8.1.2 Copyright (c) 2000-2025"),
            Some((8, 1))
        );
    }

    #[test]
    fn reads_it_past_whatever_the_packager_appended() {
        for (banner, expected) in [
            ("ffmpeg version 5.1.9-0+deb12u1 Copyright (c)", (5, 1)),
            ("ffmpeg version 8.1.2-Jellyfin Copyright (c)", (8, 1)),
            ("ffmpeg version n7.1-dev-1234 Copyright (c)", (7, 1)),
            ("ffmpeg version 7 Copyright (c)", (7, 0)),
        ] {
            assert_eq!(super::version_numbers(banner), Some(expected), "{banner}");
        }
    }

    #[test]
    fn says_nothing_rather_than_guessing_at_an_unreadable_banner() {
        assert_eq!(super::version_numbers("ffmpeg version unknown"), None);
        assert_eq!(super::version_numbers(""), None);
    }

    #[test]
    fn vouches_for_the_floor_and_anything_above_it() {
        for banner in [
            "ffmpeg version 7.0 Copyright",
            "ffmpeg version 7.1.5 Copyright",
            "ffmpeg version 8.1.2-Jellyfin Copyright",
            "ffmpeg version 9.0 Copyright",
        ] {
            assert!(super::meets_minimum(banner), "{banner}");
        }
    }

    #[test]
    fn refuses_to_vouch_for_a_build_without_scale_vt() {
        for banner in [
            "ffmpeg version 5.1.9-0+deb12u1 Copyright",
            "ffmpeg version 6.1 Copyright",
        ] {
            assert!(!super::meets_minimum(banner), "{banner}");
        }
    }

    #[tokio::test]
    async fn reports_which_rules_it_probes_by() {
        let found = super::detect_capabilities("ffmpeg", "").await;

        assert_eq!(
            found.probe_version,
            crate::probe::PROBE_VERSION,
            "the library stamps rows with this and reprobes where it moves, so a build that \
reported anything else would either reprobe forever or never"
        );
    }

    #[test]
    fn treats_a_banner_it_cannot_read_as_supported() {
        assert!(
            super::meets_minimum("ffmpeg version unknown"),
            "refusing on a banner nobody anticipated is worse than the fault guarded against"
        );
    }

    fn capabilities(encoders: Vec<VerifiedEncoder>) -> Capabilities {
        Capabilities {
            ffmpeg_version: "test".to_owned(),
            probe_version: crate::probe::PROBE_VERSION,
            ffmpeg_supported: true,
            encoders,
            hardware_accels: Vec::new(),
            tone_mapping: ToneMapping::Unavailable,
            rejected: Vec::new(),
            hardware_overlays: Vec::new(),
            hardware_tone_maps: Vec::new(),
            hardware_scalers: Vec::new(),
            can_burn_text_subtitles: false,
            can_burn_image_subtitles: false,
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

    /// The real shape of `ffmpeg -filters`, legend and all.
    ///
    /// Written from captured output rather than invented: an earlier version
    /// of this parser assumed a `------` separator that only `-encoders` has,
    /// and a made-up fixture hid the mistake until it ran against a real
    /// build.
    const FILTERS_OUTPUT: &str = concat!(
        "Filters:\n",
        "  T.. = Timeline support\n",
        "  .S. = Slice threading\n",
        "  ..C = Command support\n",
        "  A = Audio input/output\n",
        "  V = Video input/output\n",
        " ... abench            A->A       Benchmark part of a filtergraph.\n",
        " ..C scale             V->V       Scale the input video size.\n",
        " .S. tonemap           V->V       Conversion to/from dynamic ranges.\n",
        " ... zscale            V->V       Apply resizing, colorspace conversion.\n",
        " TSC overlay           VV->V      Overlay a video source on top.\n",
    );

    #[test]
    fn parses_filter_names_from_real_output() {
        let names = parse_listed_filters(FILTERS_OUTPUT);

        assert!(names.contains(&"scale".to_owned()));
        assert!(names.contains(&"tonemap".to_owned()));
        assert!(names.contains(&"zscale".to_owned()));
        assert!(names.contains(&"overlay".to_owned()));
    }

    #[test]
    fn ignores_the_legend_which_has_no_separator_to_skip_past() {
        let names = parse_listed_filters(FILTERS_OUTPUT);

        assert!(!names.iter().any(|name| name == "="));
        assert_eq!(names.len(), 5, "expected only the filter rows: {names:?}");
    }

    #[test]
    fn detects_tone_mapping_from_real_output() {
        assert_eq!(
            select_tone_mapping(&parse_listed_filters(FILTERS_OUTPUT)),
            ToneMapping::Zscale
        );
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
