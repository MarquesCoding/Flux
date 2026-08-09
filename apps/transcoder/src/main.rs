mod transcode_plan;

use transcode_plan::{AudioAction, HardwareAccel, TranscodePlan, VideoAction};

fn main() {
    let plan = TranscodePlan {
        input_path: "/media/sample.mkv".into(),
        output_path: "/transcodes/sample.m3u8".into(),
        hardware_accel: HardwareAccel::None,
        video: VideoAction::Copy,
        audio: AudioAction::Copy,
    };

    println!("flux-transcoder {}", env!("CARGO_PKG_VERSION"));
    println!("ffmpeg {}", plan.to_ffmpeg_args().join(" "));
}
