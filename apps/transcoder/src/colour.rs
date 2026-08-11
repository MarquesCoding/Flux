//! The colour a piece of media feels like.
//!
//! One frame is decoded, shrunk to a handful of pixels and reduced to a single
//! colour the interface can light a page with. Taken from the film rather than
//! from a poster, because a library with no artwork still deserves an
//! atmosphere, and because the film is the thing being watched.
// Pixel values, grid sizes and durations are all far below the point where a
// float loses an integer, and the result is a colour rounded to a byte.
#![allow(
    clippy::cast_precision_loss,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "colour arithmetic on values bounded well inside float precision"
)]

use std::path::Path;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

/// How many pixels across the frame is reduced to.
///
/// Small enough that one frame is a few hundred bytes, large enough that a
/// bright figure against a dark background survives as more than an average.
const GRID: u32 = 8;

/// Where in a film to look, as a fraction of its length.
///
/// The opening of anything is a distributor's logo on black, which would light
/// every page in the library the same shade of nothing.
const DEFAULT_POSITION: f64 = 0.25;

/// Below this, a pixel is a shadow rather than a colour.
const MIN_LIGHTNESS: f32 = 0.08;

/// Above this, a pixel is a blown highlight and says nothing about mood.
const MAX_LIGHTNESS: f32 = 0.92;

/// Below this, a pixel is grey and belongs to no part of the colour wheel.
const MIN_SATURATION: f32 = 0.12;

/// How finely the colour wheel is divided.
///
/// Twelve slices puts red, orange, yellow and so on each in their own, which is
/// about as precisely as anyone describes the colour of a film.
const HUE_BUCKETS: usize = 12;

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColourRequest {
    pub input_path: String,
    /// Where to look, in seconds. Absent means a quarter of the way in.
    #[serde(default)]
    pub at_seconds: Option<u32>,
    #[serde(default)]
    pub duration_seconds: Option<f64>,
}

/// The colour a piece of media was found to be.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Colour {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
    /// The same colour as CSS would write it, so nothing downstream has to.
    pub hex: String,
}

/// Why a colour could not be taken.
#[derive(Debug, Error)]
pub enum ColourError {
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("could not read the decoded frame: {0}")]
    Read(std::io::Error),
    #[error("that file yielded no frame to read")]
    NoFrame,
}

/// Where in the file to look.
#[must_use]
pub fn position_seconds(request: &ColourRequest) -> u32 {
    if let Some(at) = request.at_seconds {
        return at;
    }

    request
        .duration_seconds
        .filter(|duration| *duration > 0.0)
        .map_or(60, |duration| (duration * DEFAULT_POSITION) as u32)
}

/// The ffmpeg arguments that reduce one frame to a grid of pixels.
///
/// Seeking before the input so ffmpeg jumps rather than decoding up to the
/// point, and one frame only: this runs once per item in a library and should
/// cost a seek, not a playback.
#[must_use]
pub fn frame_arguments(request: &ColourRequest) -> Vec<String> {
    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-ss".to_owned(),
        position_seconds(request).to_string(),
        "-i".to_owned(),
        request.input_path.clone(),
        "-frames:v".to_owned(),
        "1".to_owned(),
        "-vf".to_owned(),
        format!("scale={GRID}:{GRID}"),
        "-f".to_owned(),
        "rawvideo".to_owned(),
        "-pix_fmt".to_owned(),
        "rgb24".to_owned(),
        "-".to_owned(),
    ]
}

/// How light a pixel is, between nothing and everything.
fn lightness(pixel: [u8; 3]) -> f32 {
    let [red, green, blue] = pixel.map(f32::from);
    let highest = red.max(green).max(blue);
    let lowest = red.min(green).min(blue);

    (highest + lowest) / 2.0 / 255.0
}

/// How colourful a pixel is, between grey and vivid.
fn saturation(pixel: [u8; 3]) -> f32 {
    let [red, green, blue] = pixel.map(f32::from);
    let highest = red.max(green).max(blue);
    let lowest = red.min(green).min(blue);

    if highest <= 0.0 {
        return 0.0;
    }

    (highest - lowest) / highest
}

/// Which slice of the colour wheel a pixel belongs to.
fn hue_bucket(pixel: [u8; 3]) -> usize {
    let [red, green, blue] = pixel.map(f32::from);
    let highest = red.max(green).max(blue);
    let lowest = red.min(green).min(blue);
    let range = highest - lowest;

    if range <= 0.0 {
        return 0;
    }

    let hue = if (highest - red).abs() < f32::EPSILON {
        (green - blue) / range % 6.0
    } else if (highest - green).abs() < f32::EPSILON {
        (blue - red) / range + 2.0
    } else {
        (red - green) / range + 4.0
    };

    let degrees = (hue * 60.0 + 360.0) % 360.0;

    (degrees / (360.0 / HUE_BUCKETS as f32)) as usize % HUE_BUCKETS
}

/// The average of a frame, however dull.
fn average_colour(samples: &[[u8; 3]]) -> [u8; 3] {
    let mut total = [0.0_f32; 3];

    for pixel in samples {
        for (channel, value) in pixel.iter().enumerate() {
            total[channel] += f32::from(*value);
        }
    }

    let count = samples.len() as f32;

    total.map(|sum| (sum / count).round().clamp(0.0, 255.0) as u8)
}

/// Reduces a grid of pixels to the one colour that describes it.
///
/// The colour a frame is *most made of*, not its average. Averaging is the
/// obvious approach and a useless one: mix enough hues and every frame lands on
/// the same muddy brown, so a whole library ends up lit identically. Instead
/// the vivid pixels are sorted onto the colour wheel and the fullest slice
/// wins, which is how a red coat against a grey street reads as red.
///
/// A frame with no colour in it at all falls back to its own average, because
/// a black and white film should light the page in its own grey rather than in
/// something invented for it.
#[must_use]
pub fn dominant_colour(pixels: &[u8]) -> Option<[u8; 3]> {
    let samples: Vec<[u8; 3]> = pixels
        .chunks_exact(3)
        .map(|chunk| [chunk[0], chunk[1], chunk[2]])
        .collect();

    if samples.is_empty() {
        return None;
    }

    let mut weights = [0.0_f32; HUE_BUCKETS];
    let mut sums = [[0.0_f32; 3]; HUE_BUCKETS];

    for pixel in &samples {
        let light = lightness(*pixel);
        let colourfulness = saturation(*pixel);

        if !(MIN_LIGHTNESS..=MAX_LIGHTNESS).contains(&light) || colourfulness < MIN_SATURATION {
            continue;
        }

        let bucket = hue_bucket(*pixel);
        // Squared, so a genuinely vivid pixel counts for far more than a
        // slightly tinted one rather than merely a little more.
        let weight = colourfulness.powi(2);

        weights[bucket] += weight;

        for (channel, value) in pixel.iter().enumerate() {
            sums[bucket][channel] += f32::from(*value) * weight;
        }
    }

    let best = weights
        .iter()
        .enumerate()
        .max_by(|left, right| left.1.total_cmp(right.1))
        .map_or(0, |(bucket, _)| bucket);

    if weights[best] <= 0.0 {
        return Some(average_colour(&samples));
    }

    Some(sums[best].map(|sum| (sum / weights[best]).round().clamp(0.0, 255.0) as u8))
}

/// Pulls a colour towards something a page can be lit with.
///
/// A frame's own colour is often either too dark to see or bright enough to
/// glare. The hue is what carries the mood, so it is kept exactly and only the
/// depth is adjusted.
#[must_use]
pub fn as_backdrop(pixel: [u8; 3]) -> [u8; 3] {
    let light = lightness(pixel);

    if light < 0.18 {
        let scale = 0.18 / light.max(0.01);

        return pixel.map(|channel| ((f32::from(channel) * scale).min(255.0)) as u8);
    }

    if light > 0.55 {
        let scale = 0.55 / light;

        return pixel.map(|channel| (f32::from(channel) * scale) as u8);
    }

    pixel
}

/// Writes a colour the way CSS reads one.
#[must_use]
pub fn to_hex(pixel: [u8; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", pixel[0], pixel[1], pixel[2])
}

/// Takes the colour of one frame of a file.
///
/// # Errors
///
/// Returns [`ColourError`] when ffmpeg cannot be started, its output cannot be
/// read, or the file yields no frame at all.
pub async fn sample_colour(ffmpeg: &str, request: &ColourRequest) -> Result<Colour, ColourError> {
    let mut decoded = read_frame(ffmpeg, request).await?;

    // Seeking past the end yields nothing at all. A file shorter than it
    // claims, or one whose length nobody recorded, should still have a colour,
    // so the second attempt starts where every file has a frame.
    if decoded.is_empty() && position_seconds(request) > 0 {
        let from_the_start = ColourRequest {
            at_seconds: Some(0),
            duration_seconds: None,
            input_path: request.input_path.clone(),
        };

        decoded = read_frame(ffmpeg, &from_the_start).await?;
    }

    let pixel = dominant_colour(&decoded)
        .map(as_backdrop)
        .ok_or(ColourError::NoFrame)?;

    Ok(Colour {
        red: pixel[0],
        green: pixel[1],
        blue: pixel[2],
        hex: to_hex(pixel),
    })
}

/// Decodes one frame into raw pixels.
async fn read_frame(ffmpeg: &str, request: &ColourRequest) -> Result<Vec<u8>, ColourError> {
    let mut child = Command::new(ffmpeg)
        .args(frame_arguments(request))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(ColourError::Spawn)?;

    let mut decoded = Vec::new();

    if let Some(mut stdout) = child.stdout.take() {
        stdout
            .read_to_end(&mut decoded)
            .await
            .map_err(ColourError::Read)?;
    }

    let _ = child.wait().await;

    Ok(decoded)
}

/// Whether a path lies inside a set of roots.
#[must_use]
pub fn is_within(path: &Path, roots: &[std::path::PathBuf]) -> bool {
    roots.is_empty() || roots.iter().any(|root| path.starts_with(root))
}

#[cfg(test)]
mod tests {
    use super::{
        as_backdrop, dominant_colour, frame_arguments, position_seconds, to_hex, ColourRequest,
    };

    fn request() -> ColourRequest {
        ColourRequest {
            input_path: "/media/film.mkv".to_owned(),
            at_seconds: None,
            duration_seconds: Some(7200.0),
        }
    }

    /// A grid of one colour, with a few of another mixed in.
    fn grid(background: [u8; 3], accent: [u8; 3], accent_count: usize) -> Vec<u8> {
        let mut pixels = Vec::new();

        for index in 0..64 {
            let pixel = if index < accent_count {
                accent
            } else {
                background
            };

            pixels.extend_from_slice(&pixel);
        }

        pixels
    }

    #[test]
    fn looks_past_the_opening_logo() {
        assert_eq!(position_seconds(&request()), 1800);
    }

    #[test]
    fn looks_where_it_is_told_to() {
        let asked = ColourRequest {
            at_seconds: Some(42),
            ..request()
        };

        assert_eq!(position_seconds(&asked), 42);
    }

    #[test]
    fn looks_somewhere_sensible_for_a_file_of_unknown_length() {
        let unknown = ColourRequest {
            duration_seconds: None,
            ..request()
        };

        assert_eq!(position_seconds(&unknown), 60);
    }

    #[test]
    fn seeks_before_the_input_so_ffmpeg_jumps_rather_than_decodes() {
        let arguments = frame_arguments(&request());
        let seek = arguments.iter().position(|a| a == "-ss").expect("seeks");
        let input = arguments.iter().position(|a| a == "-i").expect("has input");

        assert!(seek < input);
    }

    #[test]
    fn reads_one_frame_and_no_more() {
        let arguments = frame_arguments(&request());

        assert!(arguments.windows(2).any(|w| w == ["-frames:v", "1"]));
    }

    #[test]
    fn asks_for_raw_pixels_rather_than_a_picture() {
        let arguments = frame_arguments(&request());

        assert!(arguments.windows(2).any(|w| w == ["-pix_fmt", "rgb24"]));
        assert!(arguments.windows(2).any(|w| w == ["-f", "rawvideo"]));
    }

    #[test]
    fn reports_nothing_for_an_empty_frame() {
        assert!(dominant_colour(&[]).is_none());
    }

    #[test]
    fn reads_a_frame_of_one_colour_as_that_colour() {
        let found = dominant_colour(&grid([180, 40, 40], [180, 40, 40], 0)).expect("has a colour");

        assert_eq!(found, [180, 40, 40]);
    }

    #[test]
    fn a_vivid_subject_beats_a_grey_background() {
        // A red coat against a grey street is remembered as red, however much
        // of the frame the street occupies.
        let found =
            dominant_colour(&grid([120, 120, 120], [200, 20, 20], 6)).expect("has a colour");

        assert!(found[0] > found[1] + 30, "{found:?}");
        assert!(found[0] > found[2] + 30, "{found:?}");
    }

    #[test]
    fn ignores_the_shadows() {
        let found = dominant_colour(&grid([2, 2, 2], [40, 160, 90], 8)).expect("has a colour");

        assert!(found[1] > found[0], "{found:?}");
    }

    #[test]
    fn ignores_blown_highlights() {
        let found =
            dominant_colour(&grid([254, 254, 254], [40, 90, 200], 8)).expect("has a colour");

        assert!(found[2] > found[0], "{found:?}");
    }

    #[test]
    fn falls_back_to_the_average_for_a_frame_with_no_colour_in_it() {
        // A black and white film should be lit by its own grey rather than by
        // something invented for it.
        let found = dominant_colour(&grid([0, 0, 0], [255, 255, 255], 32)).expect("has a colour");

        assert!(found[0] > 100 && found[0] < 160, "{found:?}");
        assert_eq!(found[0], found[1]);
        assert_eq!(found[1], found[2]);
    }

    #[test]
    fn lifts_a_colour_too_dark_to_see() {
        let lifted = as_backdrop([10, 4, 4]);

        assert!(lifted[0] > 10);
    }

    #[test]
    fn tames_a_colour_bright_enough_to_glare() {
        let tamed = as_backdrop([250, 240, 230]);

        assert!(tamed[0] < 200);
    }

    #[test]
    fn keeps_the_hue_while_adjusting_the_depth() {
        let original = [200, 40, 40];
        let adjusted = as_backdrop(original);

        // Red stays the strongest channel by roughly the same margin.
        assert!(adjusted[0] > adjusted[1]);
        assert!(adjusted[0] > adjusted[2]);
    }

    #[test]
    fn leaves_a_colour_that_already_reads_well_alone() {
        let comfortable = [120, 60, 160];

        assert_eq!(as_backdrop(comfortable), comfortable);
    }

    #[test]
    fn writes_a_colour_the_way_css_reads_one() {
        assert_eq!(to_hex([255, 0, 128]), "#ff0080");
        assert_eq!(to_hex([0, 0, 0]), "#000000");
    }

    #[test]
    fn picks_the_fullest_slice_of_the_wheel_rather_than_the_mixture() {
        // A frame of every colour at once averages to brown, which would light
        // every page in a library identically. The colour a frame is most made
        // of is the one worth taking.
        let mut pixels = Vec::new();

        for index in 0..64_u8 {
            let pixel = match index % 4 {
                0 => [200, 30, 30],
                1 => [200, 40, 40],
                2 => [30, 180, 60],
                _ => [40, 60, 200],
            };

            pixels.extend_from_slice(&pixel);
        }

        let found = dominant_colour(&pixels).expect("has a colour");

        assert!(found[0] > 120, "expected a red, got {found:?}");
        assert!(found[1] < 90, "expected a red, got {found:?}");
    }

    #[test]
    fn a_single_vivid_hue_survives_a_frame_full_of_scattered_ones() {
        let mut pixels = Vec::new();
        let mut state = 0x9e37_79b9_u32;

        // Twenty pixels of one blue, and a scattering of everything else.
        // Ramps would not do: stepping through a channel walks a single arc of
        // the wheel and piles up in one slice, which is the opposite of
        // scattered.
        for index in 0..64_u32 {
            if index < 20 {
                pixels.extend_from_slice(&[40, 70, 210]);

                continue;
            }

            state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);

            pixels.extend_from_slice(&[
                (state >> 16) as u8,
                (state >> 8) as u8,
                (state & 0xff) as u8,
            ]);
        }

        let found = dominant_colour(&pixels).expect("has a colour");

        assert!(found[2] > found[0], "expected a blue, got {found:?}");
    }

    #[test]
    fn ignores_pixels_too_grey_to_belong_to_any_hue() {
        let mut pixels = Vec::new();

        for index in 0..64_u8 {
            let pixel = if index < 8 {
                [30, 170, 90]
            } else {
                [128, 126, 127]
            };

            pixels.extend_from_slice(&pixel);
        }

        let found = dominant_colour(&pixels).expect("has a colour");

        assert!(found[1] > found[0] + 40, "{found:?}");
    }
}
