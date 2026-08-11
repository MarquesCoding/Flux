//! Audio fingerprinting.
//!
//! Reduces a stretch of audio to one 32-bit hash per frame, cheap enough to
//! compare two episodes of a series against each other and robust enough that
//! the same theme tune encoded twice fingerprints almost identically.
//!
//! The hash is built from the *sign* of energy differences between neighbouring
//! frequency bands across neighbouring frames, rather than from the energies
//! themselves. A difference of differences survives a change of volume, a
//! change of codec and a change of bitrate, all of which move absolute energies
//! around while leaving the shape of the spectrum intact.
//!
//! It is unreliable on audio that barely changes. A sustained tone or near
//! silence has almost no frame-to-frame movement to measure, so the sign of
//! each difference is decided by rounding noise and two encodes of the same
//! passage disagree. Music and speech move far too much for this to matter,
//! but it is why a detected range is only trusted when several independent
//! pairs of episodes agree on it.
#![allow(
    clippy::cast_precision_loss,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "spectral arithmetic on values bounded well inside float precision"
)]
use std::f32::consts::PI;
use std::path::Path;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

/// The rate audio is decoded to.
///
/// Speech and music both carry more than enough distinguishing shape below
/// 8 kHz, and a lower rate means less to decode and fewer samples to transform.
pub const SAMPLE_RATE: u32 = 16_000;

/// Samples per analysis frame.
const FRAME_SIZE: usize = 2048;

/// How far each frame advances, giving roughly 15 frames a second.
const HOP_SIZE: usize = 1024;

/// Frequency bands the spectrum is collapsed into.
///
/// One more than the 32 bits a hash holds, because each bit compares a band
/// against its neighbour.
const BAND_COUNT: usize = 33;

/// The lowest frequency worth looking at. Below this is mains hum and rumble.
const MIN_FREQUENCY: f32 = 200.0;

/// The highest frequency worth looking at, comfortably inside what survives a
/// low bitrate encode.
const MAX_FREQUENCY: f32 = 4000.0;

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FingerprintRequest {
    pub input_path: String,
    /// Where in the file to start listening.
    #[serde(default)]
    pub start_seconds: u32,
    /// How much to listen to.
    pub duration_seconds: u32,
}

/// A fingerprint of one stretch of audio.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fingerprint {
    /// Frames per second, so a caller can turn frame counts back into time.
    pub frames_per_second: f64,
    pub start_seconds: u32,
    /// One hash per frame, in order.
    pub hashes: Vec<u32>,
}

/// Why audio could not be fingerprinted.
#[derive(Debug, Error)]
pub enum FingerprintError {
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("could not read decoded audio: {0}")]
    Read(std::io::Error),
    #[error("that file has no audio to fingerprint")]
    Silent,
}

/// How many frames a second the fingerprint carries.
#[must_use]
pub fn frames_per_second() -> f64 {
    f64::from(SAMPLE_RATE) / HOP_SIZE as f64
}

/// The ffmpeg arguments that decode a window of audio.
///
/// Seeking before the input rather than after it, so ffmpeg jumps to the
/// window instead of decoding everything up to it. Output is raw mono
/// little-endian 16-bit samples on stdout: no container, nothing to parse.
#[must_use]
pub fn decode_arguments(request: &FingerprintRequest) -> Vec<String> {
    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-ss".to_owned(),
        request.start_seconds.to_string(),
        "-t".to_owned(),
        request.duration_seconds.to_string(),
        "-i".to_owned(),
        request.input_path.clone(),
        "-vn".to_owned(),
        "-sn".to_owned(),
        "-ac".to_owned(),
        "1".to_owned(),
        "-ar".to_owned(),
        SAMPLE_RATE.to_string(),
        "-f".to_owned(),
        "s16le".to_owned(),
        "-".to_owned(),
    ]
}

/// Reads raw 16-bit samples as floats between -1 and 1.
#[must_use]
pub fn read_samples(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(2)
        .map(|pair| f32::from(i16::from_le_bytes([pair[0], pair[1]])) / 32768.0)
        .collect()
}

/// The Hann window, which tapers a frame's edges to nothing.
///
/// Without it, the abrupt cut at each frame boundary reads to the transform as
/// a click, smearing energy across every band and drowning the shape being
/// measured.
fn hann_window(size: usize) -> Vec<f32> {
    (0..size)
        .map(|index| {
            let ratio = index as f32 / (size - 1) as f32;

            0.5 - 0.5 * (2.0 * PI * ratio).cos()
        })
        .collect()
}

/// The edges of the frequency bands, spaced logarithmically.
///
/// Hearing resolves low frequencies far more finely than high ones, so equal
/// spacing would spend most of the hash on the top octave where the least
/// distinguishing detail lives.
#[must_use]
pub fn band_edges() -> Vec<usize> {
    let bin_width = SAMPLE_RATE as f32 / FRAME_SIZE as f32;
    let ratio = (MAX_FREQUENCY / MIN_FREQUENCY).powf(1.0 / BAND_COUNT as f32);

    (0..=BAND_COUNT)
        .map(|index| {
            let frequency = MIN_FREQUENCY * ratio.powi(i32::try_from(index).unwrap_or(0));
            let bin = (frequency / bin_width).round() as usize;

            bin.min(FRAME_SIZE / 2 - 1)
        })
        .collect()
}

/// The magnitude spectrum of one frame.
///
/// A direct transform rather than a fast one: a frame is 2048 samples and the
/// bands only need magnitudes at 33 frequencies, so the fast algorithm's
/// bookkeeping would cost more than it saves.
fn band_energies(frame: &[f32], window: &[f32], edges: &[usize]) -> Vec<f32> {
    let mut energies = vec![0.0; BAND_COUNT];

    for (band, energy) in energies.iter_mut().enumerate() {
        let start = edges[band];
        let end = edges[band + 1].max(start + 1);

        let mut total = 0.0;

        for bin in start..end {
            let mut real = 0.0;
            let mut imaginary = 0.0;
            let angular = 2.0 * PI * bin as f32 / FRAME_SIZE as f32;

            for (index, sample) in frame.iter().enumerate() {
                let windowed = sample * window[index];
                let phase = angular * index as f32;

                real += windowed * phase.cos();
                imaginary -= windowed * phase.sin();
            }

            total += real.mul_add(real, imaginary * imaginary).sqrt();
        }

        *energy = total / (end - start) as f32;
    }

    energies
}

/// Turns band energies into one hash per frame.
///
/// Each bit answers a single question: did this band gain more energy than its
/// neighbour did, compared with the previous frame? The answer is unchanged by
/// anything that scales the whole spectrum, which is why the fingerprint
/// survives re-encoding.
#[must_use]
pub fn hash_frames(frames: &[Vec<f32>]) -> Vec<u32> {
    let mut hashes = Vec::with_capacity(frames.len().saturating_sub(1));

    for pair in frames.windows(2) {
        let (previous, current) = (&pair[0], &pair[1]);
        let mut hash = 0_u32;

        for band in 0..BAND_COUNT - 1 {
            let change =
                (current[band] - current[band + 1]) - (previous[band] - previous[band + 1]);

            if change > 0.0 {
                hash |= 1 << band;
            }
        }

        hashes.push(hash);
    }

    hashes
}

/// Fingerprints a run of samples.
#[must_use]
pub fn fingerprint_samples(samples: &[f32]) -> Vec<u32> {
    if samples.len() < FRAME_SIZE {
        return Vec::new();
    }

    let window = hann_window(FRAME_SIZE);
    let edges = band_edges();

    let frames: Vec<Vec<f32>> = samples
        .windows(FRAME_SIZE)
        .step_by(HOP_SIZE)
        .map(|frame| band_energies(frame, &window, &edges))
        .collect();

    hash_frames(&frames)
}

/// Fingerprints a window of a file's audio.
///
/// # Errors
///
/// Returns [`FingerprintError`] when ffmpeg cannot be started, its output
/// cannot be read, or the file turns out to carry no audio.
pub async fn fingerprint(
    ffmpeg: &str,
    request: &FingerprintRequest,
) -> Result<Fingerprint, FingerprintError> {
    let mut child = Command::new(ffmpeg)
        .args(decode_arguments(request))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(FingerprintError::Spawn)?;

    let mut decoded = Vec::new();

    if let Some(mut stdout) = child.stdout.take() {
        stdout
            .read_to_end(&mut decoded)
            .await
            .map_err(FingerprintError::Read)?;
    }

    let _ = child.wait().await;

    let samples = read_samples(&decoded);
    let hashes = fingerprint_samples(&samples);

    if hashes.is_empty() {
        return Err(FingerprintError::Silent);
    }

    Ok(Fingerprint {
        frames_per_second: frames_per_second(),
        start_seconds: request.start_seconds,
        hashes,
    })
}

/// Whether a path lies inside a set of roots.
#[must_use]
pub fn is_within(path: &Path, roots: &[std::path::PathBuf]) -> bool {
    roots.is_empty() || roots.iter().any(|root| path.starts_with(root))
}

#[cfg(test)]
mod tests {
    use super::{
        band_edges, decode_arguments, fingerprint_samples, frames_per_second, hash_frames,
        read_samples, FingerprintRequest, SAMPLE_RATE,
    };
    use std::f32::consts::PI;

    fn request() -> FingerprintRequest {
        FingerprintRequest {
            input_path: "/media/episode.mkv".to_owned(),
            start_seconds: 30,
            duration_seconds: 600,
        }
    }

    /// A tone, which is the simplest thing with a stable spectrum.
    fn tone(frequency: f32, seconds: f32) -> Vec<f32> {
        let count = (SAMPLE_RATE as f32 * seconds) as usize;

        (0..count)
            .map(|index| (2.0 * PI * frequency * index as f32 / SAMPLE_RATE as f32).sin())
            .collect()
    }

    #[test]
    fn seeks_before_the_input_so_ffmpeg_jumps_rather_than_decodes() {
        let arguments = decode_arguments(&request());
        let seek = arguments.iter().position(|a| a == "-ss").expect("seeks");
        let input = arguments.iter().position(|a| a == "-i").expect("has input");

        assert!(seek < input);
    }

    #[test]
    fn asks_for_mono_audio_at_the_rate_the_bands_assume() {
        let arguments = decode_arguments(&request());

        assert!(arguments.windows(2).any(|w| w == ["-ac", "1"]));
        assert!(arguments
            .windows(2)
            .any(|w| w == ["-ar", &SAMPLE_RATE.to_string()]));
    }

    #[test]
    fn decodes_no_video_at_all() {
        let arguments = decode_arguments(&request());

        assert!(arguments.iter().any(|argument| argument == "-vn"));
    }

    #[test]
    fn writes_raw_samples_to_standard_output() {
        let arguments = decode_arguments(&request());

        assert!(arguments.windows(2).any(|w| w == ["-f", "s16le"]));
        assert_eq!(arguments.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn reads_samples_as_numbers_between_minus_one_and_one() {
        let bytes = [0x00, 0x00, 0xff, 0x7f, 0x00, 0x80];
        let samples = read_samples(&bytes);

        assert_eq!(samples.len(), 3);
        assert!((samples[0]).abs() < f32::EPSILON);
        assert!(samples[1] > 0.99);
        assert!(samples[2] < -0.99);
    }

    #[test]
    fn ignores_a_trailing_half_sample() {
        assert_eq!(read_samples(&[0x00, 0x00, 0x01]).len(), 1);
    }

    #[test]
    fn bands_climb_and_never_run_past_the_spectrum() {
        let edges = band_edges();

        assert_eq!(edges.len(), 34);
        assert!(edges.windows(2).all(|pair| pair[1] >= pair[0]));
        assert!(edges.iter().all(|bin| *bin < 1024));
    }

    #[test]
    fn reports_the_rate_needed_to_turn_frames_back_into_time() {
        assert!((frames_per_second() - 15.625).abs() < 0.001);
    }

    #[test]
    fn produces_no_hashes_for_audio_shorter_than_a_frame() {
        assert!(fingerprint_samples(&[0.0; 100]).is_empty());
    }

    #[test]
    fn fingerprints_a_tone() {
        let hashes = fingerprint_samples(&tone(1000.0, 0.5));

        assert!(!hashes.is_empty());
    }

    #[test]
    fn the_same_audio_fingerprints_the_same_way() {
        assert_eq!(
            fingerprint_samples(&tone(1000.0, 0.4)),
            fingerprint_samples(&tone(1000.0, 0.4))
        );
    }

    #[test]
    fn a_quieter_copy_fingerprints_almost_identically() {
        let loud = tone(1000.0, 0.5);
        let quiet: Vec<f32> = loud.iter().map(|sample| sample * 0.5).collect();

        let left = fingerprint_samples(&loud);
        let right = fingerprint_samples(&quiet);

        let differing = left
            .iter()
            .zip(right.iter())
            .filter(|(a, b)| a != b)
            .count();

        assert_eq!(differing, 0, "{left:?} vs {right:?}");
    }

    #[test]
    fn different_audio_fingerprints_differently() {
        let low = fingerprint_samples(&tone(400.0, 0.5));
        let high = fingerprint_samples(&tone(3000.0, 0.5));

        assert_ne!(low, high);
    }

    #[test]
    fn one_hash_is_produced_per_pair_of_frames() {
        let frames = vec![vec![0.0; 33]; 5];

        assert_eq!(hash_frames(&frames).len(), 4);
    }

    #[test]
    fn a_frame_that_changed_nothing_hashes_to_nothing() {
        let frames = vec![vec![1.0; 33]; 2];

        assert_eq!(hash_frames(&frames), vec![0]);
    }
}
