use std::path::Path;

use serde::Deserialize;
use thiserror::Error;
use tokio::process::Command;

/// What a caller asks for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameRequest {
    pub input_path: String,
    /// Where in the file to look, in seconds.
    pub at_seconds: u32,
    /// How wide the picture should be. The height follows the source.
    #[serde(default = "default_width")]
    pub width: u32,
}

const fn default_width() -> u32 {
    1280
}

/// Why a frame could not be taken.
#[derive(Debug, Error)]
pub enum FrameError {
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg could not decode a frame there: {0}")]
    Failed(String),
    #[error("ffmpeg produced no picture")]
    Empty,
}

/// The arguments that take one frame as a JPEG.
///
/// The seek comes before the input so ffmpeg jumps to the nearest keyframe
/// rather than decoding everything up to that point: the difference on a
/// feature length film is a quarter of a second against several minutes.
#[must_use]
pub fn frame_arguments(path: &Path, at_seconds: u32, width: u32) -> Vec<String> {
    vec![
        "-nostdin".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-ss".to_owned(),
        at_seconds.to_string(),
        "-i".to_owned(),
        path.to_string_lossy().into_owned(),
        "-frames:v".to_owned(),
        "1".to_owned(),
        "-vf".to_owned(),
        format!("scale={width}:-2"),
        "-f".to_owned(),
        "mjpeg".to_owned(),
        "-q:v".to_owned(),
        "3".to_owned(),
        "-".to_owned(),
    ]
}

/// Takes a single frame out of a file as a JPEG.
///
/// What a preview is going to start from, drawn before the preview can play.
/// A still of the exact frame the video will resume on is the one image that
/// can be swapped for the video without anything appearing to move.
///
/// # Errors
///
/// Returns [`FrameError`] when ffmpeg cannot be started, refuses the file, or
/// decodes nothing at that position.
pub async fn take_frame(
    ffmpeg: &str,
    path: &Path,
    at_seconds: u32,
    width: u32,
) -> Result<Vec<u8>, FrameError> {
    let output = Command::new(ffmpeg)
        .args(frame_arguments(path, at_seconds, width))
        .output()
        .await
        .map_err(FrameError::Spawn)?;

    if !output.status.success() {
        return Err(FrameError::Failed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }

    if output.stdout.is_empty() {
        return Err(FrameError::Empty);
    }

    Ok(output.stdout)
}

#[cfg(test)]
mod tests {
    use super::frame_arguments;
    use std::path::Path;

    #[test]
    fn seeks_before_opening_the_file() {
        let arguments = frame_arguments(Path::new("/media/film.mkv"), 600, 1280);

        let seek = arguments.iter().position(|argument| argument == "-ss");
        let input = arguments.iter().position(|argument| argument == "-i");

        assert!(seek < input, "input seeking is what makes this fast");
    }

    #[test]
    fn takes_exactly_one_frame() {
        let arguments = frame_arguments(Path::new("/media/film.mkv"), 10, 640);

        let frames = arguments
            .iter()
            .position(|argument| argument == "-frames:v")
            .expect("limits frames");

        assert_eq!(arguments[frames + 1], "1");
    }

    #[test]
    fn keeps_the_source_shape() {
        let arguments = frame_arguments(Path::new("/media/film.mkv"), 10, 640);

        assert!(arguments.iter().any(|argument| argument == "scale=640:-2"));
    }
}
