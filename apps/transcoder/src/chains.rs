//! Proving the filter chains this machine will actually be asked to run.

use serde::{Deserialize, Serialize};
use tokio::process::Command;

use crate::capability::VerifiedEncoder;
use crate::transcode_plan::{HardwareAccel, HardwarePipeline};

/// The size a probe frame is drawn at.
///
/// Small enough to cost nothing and large enough to survive being halved by a
/// scaler, which is what the chains under test do to it.
const PROBE_SIZE: (u32, u32) = (320, 240);

/// How many frames a probe draws.
///
/// Four rather than one, because a sheet tiles four thumbnails into a grid and
/// a filter that has not been given enough frames writes nothing — which would
/// read as a chain that does not work rather than one that was not asked.
const PROBE_FRAMES: u32 = 4;

/// A shape of filter chain, named for the work that builds it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChainShape {
    /// Decode on the device, come down for the scale, go back up to encode.
    Preview,
    /// Decode and scale on the device, come down as thumbnails, tile them.
    Sheet,
    /// Decode, scale and encode without ever leaving the device.
    Transcode,
}

impl ChainShape {
    /// Every shape, so a caller need not remember the list.
    #[must_use]
    pub fn every() -> [Self; 3] {
        [Self::Preview, Self::Sheet, Self::Transcode]
    }

    /// What to call this in a log line or a report.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Preview => "preview",
            Self::Sheet => "sheet",
            Self::Transcode => "transcode",
        }
    }
}

/// One chain shape, at one depth, on one backend, as this machine answered.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedChain {
    pub accel: HardwareAccel,
    pub shape: ChainShape,
    pub bit_depth: u8,
    pub works: bool,
    /// What ffmpeg said, where it would not run.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// What a frame of this depth is before it goes onto the device.
fn software_format(bit_depth: u8) -> &'static str {
    if bit_depth > 8 {
        "p010"
    } else {
        "nv12"
    }
}

/// The filters a shape puts between the device and the encoder.
///
/// Built to mirror what `preview`, `trickplay` and `transcode_plan` emit rather
/// than to exercise ffmpeg generally. A probe that tests something else proves
/// something else.
fn chain_for(shape: ChainShape, pipeline: HardwarePipeline, bit_depth: u8) -> String {
    let down = pipeline.download_format_for(Some(bit_depth));
    let (width, height) = PROBE_SIZE;
    let half = (width / 2, height / 2);

    match shape {
        ChainShape::Preview => {
            let narrow = if bit_depth > 8 { ",format=nv12" } else { "" };
            let up = if pipeline.encodes_from_device {
                ",hwupload"
            } else {
                ""
            };

            format!(
                "hwdownload,format={down},scale={}:{}{narrow}{up}",
                half.0, half.1
            )
        }
        ChainShape::Sheet => format!(
            "fps=1/1,{scaler}=w={}:h={},hwdownload,format={down},tile=2x2",
            half.0,
            half.1,
            scaler = pipeline.scaler,
        ),
        ChainShape::Transcode => {
            let narrow = match pipeline.narrows_to_eight_bit {
                Some(option) => format!(":{option}"),
                None => String::new(),
            };

            format!(
                "{scaler}=w={}:h={}{narrow}",
                half.0,
                half.1,
                scaler = pipeline.scaler,
            )
        }
    }
}

/// The arguments that ask a chain to prove itself.
///
/// A synthetic frame is put onto the device rather than a file decoded off one,
/// so the probe costs nothing and depends on nothing being present. What comes
/// after is the chain as it is really built, ending at the encoder the shape
/// really uses — which is where two of the failures this exists to catch turned
/// up, rather than in the filters.
#[must_use]
pub fn chain_probe_arguments(
    accel: HardwareAccel,
    shape: ChainShape,
    bit_depth: u8,
    encoder: &str,
    device: &str,
) -> Vec<String> {
    let (width, height) = PROBE_SIZE;
    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
    ];

    arguments.extend(accel.filter_device_arguments(device));

    let chain = accel.pipeline().map_or_else(String::new, |pipeline| {
        chain_for(shape, pipeline, bit_depth)
    });

    arguments.extend([
        "-f".to_owned(),
        "lavfi".to_owned(),
        "-i".to_owned(),
        format!("testsrc2=size={width}x{height}:rate=1"),
        "-frames:v".to_owned(),
        PROBE_FRAMES.to_string(),
        "-vf".to_owned(),
        format!("format={},hwupload,{chain}", software_format(bit_depth)),
    ]);

    if shape == ChainShape::Sheet {
        arguments.extend(["-f".to_owned(), "null".to_owned(), "-".to_owned()]);

        return arguments;
    }

    arguments.extend([
        "-c:v".to_owned(),
        encoder.to_owned(),
        "-f".to_owned(),
        "null".to_owned(),
        "-".to_owned(),
    ]);

    arguments
}

/// Runs one chain and says whether this machine will have it.
async fn verify_chain(
    ffmpeg: &str,
    accel: HardwareAccel,
    shape: ChainShape,
    bit_depth: u8,
    encoder: &str,
    device: &str,
) -> VerifiedChain {
    let outcome = Command::new(ffmpeg)
        .args(chain_probe_arguments(
            accel, shape, bit_depth, encoder, device,
        ))
        .output()
        .await;

    let (works, reason) = match outcome {
        Ok(output) if output.status.success() => (true, None),
        Ok(output) => (
            false,
            Some(
                String::from_utf8_lossy(&output.stderr)
                    .lines()
                    .last()
                    .unwrap_or("ffmpeg would not run the chain")
                    .trim()
                    .to_owned(),
            ),
        ),
        Err(failure) => (false, Some(failure.to_string())),
    };

    VerifiedChain {
        accel,
        shape,
        bit_depth,
        works,
        reason,
    }
}

/// Proves every chain this machine could be asked to run, before anything asks.
///
/// The filters being present is not the question, and neither is the encoder
/// running on its own — both were already checked, and a library still failed
/// every preview and every sheet. What breaks is the joins between them: frames
/// handed to a filter that cannot take them, brought down as a format the
/// context does not hold, or given to an encoder that wanted the device's own.
/// None of that shows up until the whole chain is run, which is what this does.
///
/// Both depths, because they are different frames contexts and a ten-bit film
/// fails where an eight-bit one passes.
pub async fn verify_chains(
    ffmpeg: &str,
    device: &str,
    encoders: &[VerifiedEncoder],
) -> Vec<VerifiedChain> {
    let mut verified = Vec::new();

    for encoder in encoders {
        if encoder.accel == HardwareAccel::None || encoder.codec != "h264" {
            continue;
        }

        for shape in ChainShape::every() {
            for bit_depth in [8_u8, 10_u8] {
                let outcome = verify_chain(
                    ffmpeg,
                    encoder.accel,
                    shape,
                    bit_depth,
                    &encoder.encoder,
                    device,
                )
                .await;

                if !outcome.works {
                    eprintln!(
                        "capability: {:?} {} at {bit_depth} bits will not run — {}",
                        encoder.accel,
                        shape.name(),
                        outcome.reason.as_deref().unwrap_or("no reason given"),
                    );
                }

                verified.push(outcome);
            }
        }
    }

    verified
}

/// Whether a shape is one this machine will run at this depth.
///
/// Unverified means yes. A machine nobody probed is the state everything was in
/// before this existed, and refusing to draw anything there would be a worse
/// answer than trying.
#[must_use]
pub fn runs_here(
    chains: &[VerifiedChain],
    accel: HardwareAccel,
    shape: ChainShape,
    bit_depth: Option<u8>,
) -> bool {
    let depth = if bit_depth.is_some_and(|found| found > 8) {
        10
    } else {
        8
    };

    chains
        .iter()
        .find(|chain| chain.accel == accel && chain.shape == shape && chain.bit_depth == depth)
        .is_none_or(|chain| chain.works)
}

#[cfg(test)]
mod tests {
    use super::{chain_probe_arguments, runs_here, ChainShape, VerifiedChain};
    use crate::transcode_plan::HardwareAccel;

    fn chain_of(arguments: &[String]) -> String {
        arguments
            .windows(2)
            .find(|pair| pair[0] == "-vf")
            .map(|pair| pair[1].clone())
            .expect("a filter chain")
    }

    /// The probe has to put a frame on the device, or it proves nothing about
    /// the joins it exists to test.
    #[test]
    fn puts_a_frame_on_the_device_before_the_chain_under_test() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Preview,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        ));

        assert!(chain.starts_with("format=nv12,hwupload,"), "{chain}");
    }

    /// A ten-bit frames context is a different context, and a chain that runs
    /// against one can fail against the other.
    #[test]
    fn asks_a_ten_bit_chain_for_ten_bit_frames() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Preview,
            10,
            "h264_qsv",
            "/dev/dri/renderD128",
        ));

        assert!(chain.starts_with("format=p010,hwupload,"), "{chain}");
        assert!(chain.contains("hwdownload,format=p010le,"), "{chain}");
    }

    /// The encoder is part of the chain. Two of the failures this exists to
    /// catch were the encoder refusing what the filters handed it, not the
    /// filters refusing each other.
    #[test]
    fn runs_the_chain_into_the_encoder_it_would_really_use() {
        let arguments = chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Preview,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        );

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "h264_qsv"]));
    }

    #[test]
    fn sends_a_preview_back_up_for_an_encoder_that_wants_the_device() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Preview,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        ));

        assert!(chain.ends_with(",hwupload"), "{chain}");
    }

    #[test]
    fn leaves_a_preview_down_for_an_encoder_that_takes_system_memory() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::VideoToolbox,
            ChainShape::Preview,
            8,
            "h264_videotoolbox",
            "",
        ));

        assert!(chain.contains("hwdownload,"), "{chain}");
        assert!(!chain.ends_with(",hwupload"), "{chain}");
    }

    /// A sheet scales on the device and comes down as thumbnails, which is the
    /// whole of why it is worth accelerating.
    #[test]
    fn scales_a_sheet_on_the_device_before_bringing_it_down() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Sheet,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        ));

        assert!(chain.contains("vpp_qsv=w="), "{chain}");
        assert!(
            chain.find("vpp_qsv").expect("a scaler")
                < chain.find("hwdownload").expect("a download"),
            "{chain}"
        );
    }

    /// A sheet has no encoder, so asking for one would prove something else.
    #[test]
    fn does_not_ask_a_sheet_to_encode_anything() {
        let arguments = chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Sheet,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        );

        assert!(!arguments.iter().any(|argument| argument == "-c:v"));
    }

    #[test]
    fn keeps_a_transcode_on_the_device_from_end_to_end() {
        let chain = chain_of(&chain_probe_arguments(
            HardwareAccel::Vaapi,
            ChainShape::Transcode,
            8,
            "h264_vaapi",
            "/dev/dri/renderD128",
        ));

        assert!(!chain.contains("hwdownload"), "{chain}");
        assert!(chain.contains("scale_vaapi=w="), "{chain}");
    }

    #[test]
    fn draws_enough_frames_for_a_sheet_to_tile() {
        let arguments = chain_probe_arguments(
            HardwareAccel::Qsv,
            ChainShape::Sheet,
            8,
            "h264_qsv",
            "/dev/dri/renderD128",
        );

        let frames = arguments
            .windows(2)
            .find(|pair| pair[0] == "-frames:v")
            .map(|pair| pair[1].clone())
            .expect("a frame count");

        assert_eq!(frames, "4");
    }

    fn said(accel: HardwareAccel, shape: ChainShape, bit_depth: u8, works: bool) -> VerifiedChain {
        VerifiedChain {
            accel,
            shape,
            bit_depth,
            works,
            reason: None,
        }
    }

    #[test]
    fn believes_a_chain_that_was_proved() {
        let chains = vec![said(HardwareAccel::Qsv, ChainShape::Preview, 8, true)];

        assert!(runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(8)
        ));
    }

    #[test]
    fn refuses_a_chain_that_would_not_run() {
        let chains = vec![said(HardwareAccel::Qsv, ChainShape::Preview, 10, false)];

        assert!(!runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(10)
        ));
    }

    /// A depth that failed says nothing about the other one, which is the whole
    /// reason both are probed.
    #[test]
    fn keeps_the_depths_apart() {
        let chains = vec![
            said(HardwareAccel::Qsv, ChainShape::Preview, 8, true),
            said(HardwareAccel::Qsv, ChainShape::Preview, 10, false),
        ];

        assert!(runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(8)
        ));
        assert!(!runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(10)
        ));
    }

    #[test]
    fn keeps_the_shapes_apart() {
        let chains = vec![
            said(HardwareAccel::Qsv, ChainShape::Preview, 8, false),
            said(HardwareAccel::Qsv, ChainShape::Sheet, 8, true),
        ];

        assert!(!runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(8)
        ));
        assert!(runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Sheet,
            Some(8)
        ));
    }

    /// A machine nobody probed is where everything was before this existed.
    #[test]
    fn tries_where_nothing_was_proved_either_way() {
        assert!(runs_here(
            &[],
            HardwareAccel::Qsv,
            ChainShape::Preview,
            Some(8)
        ));
    }

    #[test]
    fn treats_a_source_that_says_nothing_as_eight_bits() {
        let chains = vec![said(HardwareAccel::Qsv, ChainShape::Preview, 8, false)];

        assert!(!runs_here(
            &chains,
            HardwareAccel::Qsv,
            ChainShape::Preview,
            None
        ));
    }
}
