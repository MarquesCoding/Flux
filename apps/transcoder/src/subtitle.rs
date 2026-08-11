use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::process::Command;

/// What a caller asks to be pulled out of a container.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleRequest {
    pub input_path: String,
    /// The stream to take, as ffprobe numbered it.
    pub stream_index: u32,
}

/// A track pulled out of a container.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    /// The whole track as `WebVTT`.
    pub content: String,
}

/// Why a track could not be read.
#[derive(Debug, Error)]
pub enum SubtitleError {
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg could not read that subtitle stream: {0}")]
    Failed(String),
    #[error("that subtitle stream is empty")]
    Empty,
}

/// The arguments that convert one embedded track to `WebVTT`.
///
/// Only the one stream is mapped and nothing else is decoded, so this reads
/// the subtitle packets and skips the video entirely — a feature length film
/// converts in about a second rather than in the minutes a re-encode takes.
#[must_use]
pub fn extract_arguments(path: &Path, stream_index: u32) -> Vec<String> {
    vec![
        "-nostdin".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-i".to_owned(),
        path.to_string_lossy().into_owned(),
        "-map".to_owned(),
        format!("0:{stream_index}"),
        "-c:s".to_owned(),
        "webvtt".to_owned(),
        "-f".to_owned(),
        "webvtt".to_owned(),
        "-".to_owned(),
    ]
}

/// Reads one subtitle stream out of a container as `WebVTT`.
///
/// Text tracks only. A picture based track — PGS or `VobSub` — carries images
/// rather than characters and cannot become text at all; those are burned into
/// the video instead, which is decided when playback is negotiated.
///
/// # Errors
///
/// Returns [`SubtitleError`] when ffmpeg cannot be started, it refuses the
/// stream, or the stream turns out to hold nothing.
pub async fn extract_subtitle(
    ffmpeg: &str,
    path: &Path,
    stream_index: u32,
) -> Result<SubtitleTrack, SubtitleError> {
    let output = Command::new(ffmpeg)
        .args(extract_arguments(path, stream_index))
        .output()
        .await
        .map_err(SubtitleError::Spawn)?;

    if !output.status.success() {
        return Err(SubtitleError::Failed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }

    let content = String::from_utf8_lossy(&output.stdout).into_owned();

    if content.trim().len() <= "WEBVTT".len() {
        return Err(SubtitleError::Empty);
    }

    Ok(SubtitleTrack { content })
}

#[cfg(test)]
mod tests {
    use super::extract_arguments;
    use std::path::Path;

    #[test]
    fn maps_only_the_stream_it_was_asked_for() {
        let arguments = extract_arguments(Path::new("/media/film.mkv"), 3);

        let map = arguments.iter().position(|argument| argument == "-map");

        assert_eq!(arguments[map.expect("maps") + 1], "0:3");
    }

    #[test]
    fn writes_webvtt_to_standard_output() {
        let arguments = extract_arguments(Path::new("/media/film.mkv"), 2);

        assert_eq!(arguments.last().map(String::as_str), Some("-"));
        assert!(arguments.iter().any(|argument| argument == "webvtt"));
    }

    #[test]
    fn never_waits_on_standard_input() {
        let arguments = extract_arguments(Path::new("/media/film.mkv"), 0);

        assert_eq!(arguments.first().map(String::as_str), Some("-nostdin"));
    }
}
