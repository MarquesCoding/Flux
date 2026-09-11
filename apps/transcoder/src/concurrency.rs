//! Measuring how much hardware work this machine will do at once.

use std::time::Duration;

use tokio::process::Command;
use tokio::task::JoinSet;
use tokio::time::timeout;

use crate::capability::VerifiedEncoder;
use crate::transcode_plan::HardwareAccel;

/// The size a probe encodes at.
///
/// A real frame rather than a token one. A tiny picture costs so little GPU
/// memory that a machine will open far more sessions of it than it could ever
/// open of a film, which would answer the question being asked with a number
/// that does not apply to the work.
const PROBE_SIZE: (u32, u32) = (1920, 1080);

/// How many frames a probe encodes.
///
/// Enough that the probes in a round genuinely overlap. Sessions that open and
/// close one after another never contend, and contention is the whole question.
const PROBE_FRAMES: u32 = 60;

/// How long a round is given before it is called a failure.
const ROUND_LIMIT: Duration = Duration::from_secs(30);

/// The widths tried, in order.
const WIDTHS: [u32; 5] = [2, 4, 6, 8, 12];

/// What a machine is assumed to manage when nothing could be measured.
const WHEN_UNKNOWN: u32 = 2;

/// The arguments for one probe session.
fn session_arguments(accel: HardwareAccel, encoder: &str, device: &str) -> Vec<String> {
    let (width, height) = PROBE_SIZE;
    let mut arguments = vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
    ];

    arguments.extend(accel.filter_device_arguments(device));

    let chain = accel.pipeline().map_or_else(
        || "format=nv12".to_owned(),
        |pipeline| format!("format=nv12,{}", pipeline.upload),
    );

    arguments.extend([
        "-f".to_owned(),
        "lavfi".to_owned(),
        "-i".to_owned(),
        format!("testsrc2=size={width}x{height}:rate=25"),
        "-frames:v".to_owned(),
        PROBE_FRAMES.to_string(),
        "-vf".to_owned(),
        chain,
        "-c:v".to_owned(),
        encoder.to_owned(),
        "-f".to_owned(),
        "null".to_owned(),
        "-".to_owned(),
    ]);

    arguments
}

/// Whether this machine will run this many of them at the same time.
async fn width_holds(
    ffmpeg: &str,
    accel: HardwareAccel,
    encoder: &str,
    device: &str,
    width: u32,
) -> bool {
    let mut running = JoinSet::new();

    for _ in 0..width {
        let ffmpeg = ffmpeg.to_owned();
        let arguments = session_arguments(accel, encoder, device);

        running.spawn(async move { Command::new(ffmpeg).args(arguments).output().await });
    }

    let every = async move {
        let mut held = true;

        while let Some(joined) = running.join_next().await {
            let succeeded = joined
                .ok()
                .and_then(Result::ok)
                .is_some_and(|output| output.status.success());

            if !succeeded {
                held = false;
            }
        }

        held
    };

    timeout(ROUND_LIMIT, every).await.unwrap_or(false)
}

/// How many hardware renders this machine will run at once.
///
/// Asked of the machine rather than worked out from its processors, because the
/// two have nothing to do with each other. A render on the device costs a
/// session and a share of the device's memory, and a graphics chip has a fixed
/// number of both however many cores sit beside it — so a twenty core server
/// with one iGPU will run no more of them than a four core one with the same
/// iGPU, and asking it for ten opens sessions that fail rather than work that
/// finishes.
///
/// Widths are tried upward and the search stops at the first that does not
/// hold, since a machine that will not run eight will not run twelve.
///
/// A machine with nothing to accelerate is not asked. Software renders are
/// bounded by processors, which the caller already knows.
///
/// This is a floor on what the machine can do and not a promise about a
/// library: the probe encodes a made-up picture, where real work also decodes a
/// film on the same device. An operator who knows better can still say.
pub async fn verify_concurrency(ffmpeg: &str, device: &str, encoders: &[VerifiedEncoder]) -> u32 {
    let Some(found) = encoders
        .iter()
        .find(|encoder| encoder.codec == "h264" && encoder.accel != HardwareAccel::None)
    else {
        return 0;
    };

    let mut held = WHEN_UNKNOWN;

    for width in WIDTHS {
        if !width_holds(ffmpeg, found.accel, &found.encoder, device, width).await {
            break;
        }

        held = width;
    }

    held
}

#[cfg(test)]
mod tests {
    use super::{session_arguments, verify_concurrency, PROBE_FRAMES};
    use crate::capability::VerifiedEncoder;
    use crate::transcode_plan::HardwareAccel;

    fn encoder(codec: &str, name: &str, accel: HardwareAccel) -> VerifiedEncoder {
        VerifiedEncoder {
            codec: codec.to_owned(),
            encoder: name.to_owned(),
            accel,
            verified: true,
        }
    }

    /// Software renders are bounded by processors, which the caller knows.
    #[tokio::test]
    async fn does_not_ask_a_machine_with_nothing_to_accelerate() {
        let software = vec![encoder("h264", "libx264", HardwareAccel::None)];

        assert_eq!(
            verify_concurrency("ffmpeg", "/dev/dri/renderD128", &software).await,
            0
        );
        assert_eq!(
            verify_concurrency("ffmpeg", "/dev/dri/renderD128", &[]).await,
            0
        );
    }

    #[tokio::test]
    async fn answers_nothing_where_ffmpeg_will_not_run_at_all() {
        let hardware = vec![encoder("h264", "h264_qsv", HardwareAccel::Qsv)];
        let held = verify_concurrency(
            "not-an-ffmpeg-on-this-machine",
            "/dev/dri/renderD128",
            &hardware,
        )
        .await;

        assert_eq!(
            held, 2,
            "a machine that answers nothing is assumed to manage a pair"
        );
    }

    #[test]
    fn probes_at_a_real_size_rather_than_a_token_one() {
        let arguments = session_arguments(HardwareAccel::Qsv, "h264_qsv", "/dev/dri/renderD128");
        let input = arguments
            .iter()
            .position(|argument| argument == "-i")
            .and_then(|at| arguments.get(at + 1))
            .expect("an input");

        assert!(input.contains("1920x1080"), "{input}");
    }

    /// Sessions that never overlap never contend, and contention is the question.
    #[test]
    fn encodes_enough_frames_that_the_sessions_overlap() {
        let arguments = session_arguments(HardwareAccel::Qsv, "h264_qsv", "/dev/dri/renderD128");

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-frames:v", &PROBE_FRAMES.to_string()]));
        const { assert!(PROBE_FRAMES >= 30) };
    }

    #[test]
    fn puts_the_frames_on_the_device_the_encoder_wants_them_on() {
        let arguments = session_arguments(HardwareAccel::Qsv, "h264_qsv", "/dev/dri/renderD128");
        let chain = arguments
            .iter()
            .position(|argument| argument == "-vf")
            .and_then(|at| arguments.get(at + 1))
            .expect("a filter chain");

        assert!(chain.contains("hwupload"), "{chain}");
        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-c:v", "h264_qsv"]));
    }
}
