//! What a real bitmap subtitle costs, and which route it actually takes.
//!
//! 1,156 of the 6,207 files in the reference library — 18.6% — carry PGS or
//! `VobSub`, and every one of them forces a burn-in: a bitmap subtitle cannot be
//! converted to text, so the picture has to be re-encoded with the subtitle
//! drawn onto it. That turns a free stream copy into a full video encode for
//! nearly a fifth of the library.
//!
//! `frame_route` already decides where that happens, and its unit tests cover
//! every branch. What they cover it with is a hand-written `SessionSpec`: the
//! `is_image_based` flag is set by the test rather than read off a file. This
//! drives the same decision from a real probe of a real bitmap-subtitle file,
//! so a change that made the probe and the router disagree would be caught.
//!
//! Then it runs the graph, and looks at the frames that come out. A route is
//! only worth choosing if it draws the subtitle, and that is not the same
//! question as whether `FFmpeg` accepted the arguments: the software route
//! overlaid the subtitle stream untouched, at its own canvas size, which put
//! the text below the picture on every file whose canvas was the larger of the
//! two. `FFmpeg` succeeded, segments were written, and the film came out of a
//! full re-encode with nothing drawn on it. Comparing against the same source
//! encoded without the subtitle is what catches that; nothing else here does.
//!
//! # The measurement
//!
//! Taken against the reference library itself rather than the corpus, because
//! the corpus fixtures are 23 KB near-static test patterns and an encode cost
//! measured on one would say nothing about a film. 25 files, stratified by
//! codec and resolution, 60 seconds of content from each, software `overlay`
//! into `libx264 -preset veryfast`, reading from a warm cache so the number is
//! processor time rather than network:
//!
//! | source | files | burn-in, relative to realtime |
//! | -- | -- | -- |
//! | 1080p H.264 | 3 | 13.5–15.8x |
//! | 1080p HEVC | 12 | 9.5–14.9x |
//! | 1080p AV1 | 6 | 11.1–12.3x |
//! | 2160p HEVC | 4 | 2.7–5.4x |
//!
//! The copy it replaces costs 0.09–0.42s for the same 60 seconds, so the
//! encode is between one and two orders of magnitude more expensive. It is
//! also, on every file measured, faster than the viewer watching it — which is
//! the question that decides whether 18.6% of the library is a problem. At
//! 1080p there is roughly a tenfold margin. At 2160p the margin is between
//! 2.7x and 5.4x, and that is the one to watch: it was measured as a single
//! stream on an idle machine, so a second concurrent 4K burn-in eats most of
//! what is left.
//!
//! Skips loudly when the corpus is absent, as ADR-0012 requires. Build it with
//! `pnpm fixtures:sync --tier 1`.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::process::Command;

use flux_transcoder::transcode_plan::{
    frame_route, AudioAction, DeviceFilters, FrameRoute, HardwareAccel, SegmentContainer,
    SegmentStart, SessionSpec, SubtitleAction, TranscodePlan, VideoAction, RUN_PLAYLIST_NAME,
};

mod common;

use common::{ffmpeg, ffprobe};

/// The codecs `negotiatePlayback` calls image based, by their ffprobe names.
///
/// `IMAGE_SUBTITLE_FORMATS` in `negotiatePlayback.ts` lists the same three
/// under Flux's own shorter names. Both lists exist because the negotiation
/// reads a normalised name off a `MediaItem` and this reads what ffprobe
/// printed, and they have to agree about which files force a burn-in.
const IMAGE_SUBTITLE_CODECS: [&str; 3] = ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle"];

/// A build with a scaler and no compositor.
///
/// What a stock macOS `FFmpeg` is: `scale_vt` has been upstream since 7.0 and
/// `overlay_videotoolbox` is a patch flux-ffmpeg carries, so this is the
/// combination a developer machine actually reports.
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

/// Where the corpus lives, matching `fixturesDirectory` on the TypeScript side.
fn corpus_directory() -> PathBuf {
    if let Ok(configured) = std::env::var("FLUX_FIXTURES_DIR") {
        if !configured.trim().is_empty() {
            return PathBuf::from(configured);
        }
    }

    let home = std::env::var("HOME").unwrap_or_default();

    PathBuf::from(home).join(".cache").join("flux-fixtures")
}

/// The corpus fixtures carrying a bitmap subtitle.
///
/// Named rather than discovered: a fixture whose subtitle stream failed to
/// generate would otherwise drop out of the list and take its assertions with
/// it, and a test that silently stops testing something is worse than one that
/// fails.
fn bitmap_fixtures() -> Vec<PathBuf> {
    [
        "pgs-subtitles.mkv",
        "vobsub-subtitles.mkv",
        "dvbsub-subtitles.mkv",
    ]
    .iter()
    .map(|name| corpus_directory().join(name))
    .filter(|path| path.exists())
    .collect()
}

fn name_of(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_owned()
}

/// The codec of each subtitle stream, in the order the burn-in counts them.
///
/// `-select_streams s` makes ffprobe number them the way `[0:s:N]` and the
/// `subtitles` filter's `si=` do, which is not the stream's index in the
/// container. Passing a container index produced a filtergraph that matched no
/// streams and a film that would not play.
fn subtitle_codecs(path: &Path) -> Vec<String> {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "s",
            "-show_entries",
            "stream=codec_name",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .expect("runs ffprobe");

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| line.trim().trim_end_matches(',').to_owned())
        .filter(|line| !line.is_empty())
        .collect()
}

/// The picture size, which a hardware route has to be told.
fn video_size(path: &Path) -> Option<(u32, u32)> {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next()?;
    let (width, height) = line.trim().split_once(',')?;

    Some((width.parse().ok()?, height.parse().ok()?))
}

/// A session that burns the first bitmap subtitle of this file into the video.
fn burn_in_spec(path: &Path, subtitle_index: u32, accel: HardwareAccel) -> SessionSpec {
    SessionSpec {
        input_path: path.to_string_lossy().into_owned(),
        start_seconds: 0,
        segment_seconds: 4,
        hardware_accel: accel,
        video: VideoAction::Encode {
            encoder: "libx264".to_owned(),
            max_bitrate_kbps: 6000,
            max_width: 1920,
            max_height: 1080,
            tone_map: None,
        },
        audio: AudioAction::Copy,
        audio_stream_index: None,
        subtitles: SubtitleAction::BurnIn {
            subtitle_index,
            is_image_based: true,
        },
        source_size: video_size(path),
        container: SegmentContainer::default(),
    }
}

fn plan_for(spec: SessionSpec, filters: DeviceFilters, output: &Path) -> TranscodePlan {
    TranscodePlan {
        spec,
        output_directory: output.to_string_lossy().into_owned(),
        device: "/dev/dri/renderD128".to_owned(),
        device_filters: filters,
        start_at: SegmentStart::default(),
        cut_seconds: 4.0,
    }
}

fn skipped() -> bool {
    if bitmap_fixtures().is_empty() {
        eprintln!(
            "skipping: no bitmap subtitle fixtures. Build them with `pnpm fixtures:sync --tier 1`."
        );

        return true;
    }

    false
}

/// Every bitmap fixture probes as one, and carries exactly one subtitle.
///
/// The floor under the rest: a fixture whose subtitle stream did not survive
/// generation would make every routing assertion below vacuously true, since
/// they all begin by finding an image subtitle to route.
#[test]
fn bitmap_fixtures_probe_as_bitmap() {
    if skipped() {
        return;
    }

    for path in bitmap_fixtures() {
        let name = name_of(&path);
        let codecs = subtitle_codecs(&path);

        assert_eq!(codecs.len(), 1, "{name}: expected one subtitle stream");

        let codec = &codecs[0];

        assert!(
            IMAGE_SUBTITLE_CODECS.contains(&codec.as_str()),
            "{name}: {codec} is not a format that forces a burn-in"
        );
    }
}

/// A bitmap subtitle goes where the build can actually draw it.
///
/// Driven from the probe rather than from a flag a test set, which is the
/// whole point: `is_image_based` is the one field deciding whether a burn-in
/// can descend to software and come back, and everything downstream of it
/// trusts that it describes the file.
///
/// A compositor sends it to `Composited`, where what crosses the bus is a
/// small overlay. Without one there is nowhere for a second stream to go but
/// `InSoftware` — the text route's `hwdownload,subtitles,hwupload` is a linear
/// chain and a bitmap subtitle cannot be expressed in one. That is the
/// difference between crossing the bus with an overlay and crossing it with
/// the film, and it is the reason `overlay_videotoolbox` is worth patching in.
#[test]
fn a_bitmap_subtitle_routes_by_what_the_build_has() {
    if skipped() {
        return;
    }

    for path in bitmap_fixtures() {
        let name = name_of(&path);
        let codecs = subtitle_codecs(&path);
        let index = codecs
            .iter()
            .position(|codec| IMAGE_SUBTITLE_CODECS.contains(&codec.as_str()))
            .expect("the fixture carries a bitmap subtitle");
        let spec = burn_in_spec(
            &path,
            u32::try_from(index).expect("a subtitle index fits"),
            HardwareAccel::VideoToolbox,
        );

        assert_eq!(
            frame_route(&spec, FULL),
            FrameRoute::Composited,
            "{name}: a compositor should draw the subtitle on the device"
        );
        assert_eq!(
            frame_route(&spec, SCALER_ONLY),
            FrameRoute::InSoftware,
            "{name}: without a compositor a bitmap subtitle has nowhere to go but software"
        );
        assert_eq!(
            frame_route(&spec, DeviceFilters::default()),
            FrameRoute::InSoftware,
            "{name}: a build with no hardware filters at all stays in software"
        );
    }
}

/// The composited graph is one `FFmpeg` accepts, and pads what it must.
///
/// The fixtures carry a 1280x720 subtitle over a 720x480 picture, which is the
/// case `composited_graph` pads for rather than assuming the two share an
/// aspect ratio. Asserting on the string is what can be done without the
/// patched build: the arguments are checked here and executed below on the
/// software route, which shares the overlay and differs only in where it runs.
#[test]
fn a_composited_burn_in_names_its_own_streams() {
    if skipped() {
        return;
    }

    let output = std::env::temp_dir().join("flux-image-subtitle-route");
    std::fs::create_dir_all(&output).expect("creates the output directory");

    for path in bitmap_fixtures() {
        let name = name_of(&path);
        let spec = burn_in_spec(&path, 0, HardwareAccel::VideoToolbox);
        let args = plan_for(spec, FULL, &output).to_ffmpeg_args();
        let graph = args
            .iter()
            .position(|arg| arg == "-filter_complex")
            .and_then(|at| args.get(at + 1))
            .unwrap_or_else(|| panic!("{name}: a composited burn-in needs a filtergraph"));

        assert!(
            graph.contains("[0:s:0]"),
            "{name}: the subtitle stream is never read: {graph}"
        );
        assert!(
            graph.contains("pad="),
            "{name}: a subtitle of a different shape must be padded: {graph}"
        );
        assert!(
            graph.contains("overlay_videotoolbox"),
            "{name}: the compositor is not the backend's: {graph}"
        );
        assert!(
            args.windows(2)
                .any(|pair| pair[0] == "-map" && pair[1] == "[v]"),
            "{name}: the composited output is never mapped"
        );
    }
}

/// The software burn-in runs, and writes segments with the subtitle in them.
///
/// The route 18.6% of the library takes on a build without a compositor, which
/// is every stock one. Runs `FFmpeg` for real against the arguments Flux would
/// have given it: a filtergraph that is merely well formed still fails if the
/// overlay cannot find its stream, and that failure would otherwise be a
/// session that never starts rather than a test that goes red.
#[test]
fn a_software_burn_in_actually_encodes() {
    if skipped() {
        return;
    }

    for path in bitmap_fixtures() {
        let name = name_of(&path);
        let output = std::env::temp_dir().join(format!("flux-burn-in-{name}"));

        let _ = std::fs::remove_dir_all(&output);
        std::fs::create_dir_all(&output).expect("creates the output directory");

        let spec = burn_in_spec(&path, 0, HardwareAccel::None);
        let args = plan_for(spec, DeviceFilters::default(), &output).to_ffmpeg_args();

        let result = Command::new(ffmpeg())
            .args(&args)
            .output()
            .expect("runs ffmpeg");

        assert!(
            result.status.success(),
            "{name}: the burn-in failed: {}",
            String::from_utf8_lossy(&result.stderr)
        );

        let segments = std::fs::read_dir(&output)
            .expect("reads the output directory")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name() != std::ffi::OsStr::new(RUN_PLAYLIST_NAME))
            .filter(|entry| entry.metadata().is_ok_and(|data| data.len() > 0))
            .count();

        assert!(segments > 0, "{name}: the burn-in wrote no segments");

        let _ = std::fs::remove_dir_all(&output);
    }
}

/// Renders the frames a graph produces, and hands back their bytes.
fn frames_of(path: &Path, graph_arguments: &[String], into: &Path) -> Vec<Vec<u8>> {
    let _ = std::fs::remove_dir_all(into);
    std::fs::create_dir_all(into).expect("creates the frame directory");

    let status = Command::new(ffmpeg())
        .args(["-hide_banner", "-loglevel", "error"])
        .arg("-i")
        .arg(path)
        .args(graph_arguments)
        .args(["-fps_mode", "passthrough"])
        .arg("-y")
        .arg(into.join("%04d.png"))
        .status()
        .expect("runs ffmpeg");

    assert!(status.success(), "could not render frames");

    let mut names: Vec<PathBuf> = std::fs::read_dir(into)
        .expect("reads the frame directory")
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .collect();

    names.sort();

    names
        .iter()
        .map(|frame| std::fs::read(frame).expect("reads a frame"))
        .collect()
}

/// The burn-in actually puts the subtitle on the picture.
///
/// The assertion the rest of this file was missing, and the one that matters:
/// a filtergraph that runs, produces segments and draws nothing is
/// indistinguishable from a working one by every other check here. It is also
/// what the software route did until the subtitle was sized — it overlaid a
/// 1280x720 canvas onto a 720x480 picture at the origin, which put the text
/// below the frame, so 18.6% of the library was re-encoded in full and came
/// out exactly as it went in.
///
/// Compared against the same source encoded without the subtitle, so the only
/// difference between the two runs is the thing being tested.
#[test]
fn a_software_burn_in_draws_the_subtitle() {
    if skipped() {
        return;
    }

    let output = std::env::temp_dir().join("flux-burn-in-frames");

    for path in bitmap_fixtures() {
        let name = name_of(&path);
        let spec = burn_in_spec(&path, 0, HardwareAccel::None);
        let (width, height) = spec.source_size.expect("the fixture has a size");
        let args = plan_for(spec, DeviceFilters::default(), &output).to_ffmpeg_args();
        let graph = args
            .iter()
            .position(|arg| arg == "-filter_complex")
            .and_then(|at| args.get(at + 1))
            .unwrap_or_else(|| panic!("{name}: a bitmap burn-in needs a filtergraph"))
            .clone();

        let burned = frames_of(
            &path,
            &[
                "-filter_complex".to_owned(),
                graph,
                "-map".to_owned(),
                "[v]".to_owned(),
            ],
            &output.join("burned"),
        );
        let plain = frames_of(
            &path,
            &[
                "-map".to_owned(),
                "0:v:0".to_owned(),
                "-vf".to_owned(),
                format!("scale={width}:{height}"),
            ],
            &output.join("plain"),
        );

        assert!(!burned.is_empty(), "{name}: the burn-in rendered no frames");

        let drawn = burned
            .iter()
            .zip(&plain)
            .filter(|(with, without)| with != without)
            .count();

        assert!(
            drawn > 0,
            "{name}: every frame came out identical to one encoded without the subtitle, \
             so the burn-in drew nothing"
        );
        assert_eq!(
            burned.len(),
            plain.len(),
            "{name}: the burn-in changed how many frames come out"
        );
    }

    let _ = std::fs::remove_dir_all(&output);
}
