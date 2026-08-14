//! Checks that a fragment moved into place really does play there.
//!
//! The unit tests build fragments by hand, which proves the box walking but
//! not that ffmpeg's output looks the way it is assumed to. This cuts a real
//! film twice — once whole, once from the middle — and checks that the second
//! run's segment, once placed, decodes in the first run's timeline.
//!
//! It is the fault this exists for: without placing, ten seconds of that film
//! disappear with nothing reported.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::Command;

use flux_transcoder::fragment::{
    decode_time_for, fragment_positions, set_fragment_positions, track_timescales,
};

fn ffmpeg() -> String {
    std::env::var("FLUX_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_owned())
}

fn ffprobe() -> String {
    std::env::var("FLUX_FFPROBE").unwrap_or_else(|_| "ffprobe".to_owned())
}

fn available() -> bool {
    Command::new(ffmpeg())
        .arg("-version")
        .output()
        .is_ok_and(|output| output.status.success())
}

/// A minute of film with a keyframe every ten seconds.
fn source(at: &Path) {
    let status = Command::new(ffmpeg())
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=25",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "60",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-g",
            "250",
            "-keyint_min",
            "250",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
        ])
        .arg(at)
        .status()
        .expect("ran ffmpeg");

    assert!(status.success(), "could not build the source");
}

/// Cuts a film into fMP4 segments, optionally starting part way in.
fn segment(source: &Path, into: &Path, from: Option<u32>, first: u32) {
    std::fs::create_dir_all(into).expect("made a directory");

    let mut command = Command::new(ffmpeg());
    command.args(["-hide_banner", "-loglevel", "error", "-y"]);

    if let Some(seconds) = from {
        command.args(["-ss", &seconds.to_string()]);
    }

    command
        .arg("-i")
        .arg(source)
        .args([
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_type",
            "fmp4",
            "-hls_list_size",
            "0",
            "-start_number",
            &first.to_string(),
            "-hls_fmp4_init_filename",
            "init.mp4",
            "-hls_segment_filename",
        ])
        .arg(into.join("segment%05d.m4s"))
        .arg(into.join("index.m3u8"));

    assert!(
        command.status().expect("ran ffmpeg").success(),
        "segmenting failed"
    );
}

fn frames_in(playlist: &Path) -> u64 {
    let output = Command::new(ffprobe())
        .args([
            "-v",
            "error",
            "-count_frames",
            "-select_streams",
            "v",
            "-show_entries",
            "stream=nb_read_frames",
            "-of",
            "csv=p=0",
        ])
        .arg(playlist)
        .output()
        .expect("ran ffprobe");

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .and_then(|line| line.trim().parse().ok())
        .unwrap_or(0)
}

#[test]
fn a_placed_fragment_decodes_where_the_playlist_says_it_is() {
    if !available() {
        eprintln!("skipping: no ffmpeg on this machine");

        return;
    }

    let root: PathBuf = std::env::temp_dir().join(format!("flux-fragment-{}", std::process::id()));
    std::fs::create_dir_all(&root).expect("made a directory");

    let film = root.join("source.mp4");
    source(&film);

    let whole = root.join("whole");
    let middle = root.join("middle");

    segment(&film, &whole, None, 0);
    segment(&film, &middle, Some(50), 5);

    let timescales = track_timescales(&std::fs::read(whole.join("init.mp4")).expect("an init"));

    assert!(
        !timescales.is_empty(),
        "no timescales were read from the initialisation segment"
    );

    let mixed = root.join("mixed");
    std::fs::create_dir_all(&mixed).expect("made a directory");
    std::fs::copy(whole.join("init.mp4"), mixed.join("init.mp4")).expect("copied the init");

    let lengths: Vec<f64> = std::fs::read_to_string(whole.join("index.m3u8"))
        .expect("a playlist")
        .lines()
        .filter_map(|line| line.strip_prefix("#EXTINF:"))
        .filter_map(|value| value.trim_end_matches(',').parse().ok())
        .collect();

    let last = lengths.len() - 1;

    for index in 0..last {
        let name = format!("segment{index:05}.m4s");
        std::fs::copy(whole.join(&name), mixed.join(&name)).expect("copied a segment");
    }

    let name = format!("segment{last:05}.m4s");
    let mut replacement = std::fs::read(middle.join(&name)).expect("a segment from the other run");

    let start: f64 = lengths[..last].iter().sum();
    let starts: HashMap<u32, u64> = timescales
        .iter()
        .map(|(track, timescale)| (*track, decode_time_for(start, *timescale)))
        .collect();

    assert_eq!(
        fragment_positions(&replacement)
            .values()
            .copied()
            .max()
            .unwrap_or(0),
        0,
        "the other run's segment should claim to start at nothing"
    );

    let placed = set_fragment_positions(&mut replacement, &starts);

    assert!(placed > 0, "nothing was placed");

    std::fs::write(mixed.join(&name), &replacement).expect("wrote the segment");

    let playlist = mixed.join("index.m3u8");
    let mut text = String::from(
        "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-TARGETDURATION:11\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-MAP:URI=\"init.mp4\"\n",
    );

    for (index, length) in lengths.iter().enumerate() {
        let _ = write!(text, "#EXTINF:{length:.6},\nsegment{index:05}.m4s\n");
    }

    text.push_str("#EXT-X-ENDLIST\n");
    std::fs::write(&playlist, text).expect("wrote the playlist");

    let decoded = frames_in(&playlist);
    let expected = frames_in(&whole.join("index.m3u8"));

    let _ = std::fs::remove_dir_all(&root);

    assert_eq!(
        decoded, expected,
        "a placed fragment should decode like the one it stands in for"
    );
}
