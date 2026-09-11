//! Whether a file the service just wrote can actually be played.
//!
//! Everything produced here was accepted on two questions: did ffmpeg exit zero,
//! and is there something on disk. Both can be true of a file that does not
//! decode. An encoder under contention can hand back a bitstream whose headers
//! disagree with their contents, and the container is written around it all the
//! same — 16 MB, the right duration, the right dimensions, and black on play.
//!
//! Nothing downstream would ever notice. A `.complete` marker means the work is
//! done, and a cached file is never made twice, so a clip that encoded to
//! rubbish is served for as long as the cache lives.
//!
//! So the file is decoded before it counts as finished. That costs a fraction of
//! what making it cost, and it turns a permanent silent corruption into an
//! ordinary failure — which the software fallback already knows how to handle.

use std::path::Path;

use tokio::process::Command;

use crate::capability::summarise_failure;

/// What is said when a decode fails without ffmpeg explaining itself.
const SILENT_FAILURE: &str = "the file would not decode, and ffmpeg said nothing about why";

/// The ffmpeg arguments that decode a file and write nothing.
///
/// Decoded in software deliberately. The question is whether the bitstream is
/// sound, and asking the same hardware that produced it to read it back can hide
/// the very fault being looked for.
///
/// `-xerror` stops at the first complaint. The corrupt clip that prompted this
/// produced over three thousand of them, and the first one is enough.
#[must_use]
pub fn decode_arguments(path: &Path) -> Vec<String> {
    vec![
        "-hide_banner".to_owned(),
        "-loglevel".to_owned(),
        "error".to_owned(),
        "-nostdin".to_owned(),
        "-xerror".to_owned(),
        "-i".to_owned(),
        path.to_string_lossy().into_owned(),
        "-f".to_owned(),
        "null".to_owned(),
        "-".to_owned(),
    ]
}

/// Decodes a file, and says what went wrong when it will not.
///
/// # Errors
///
/// Returns the decoder's own complaint when the file does not decode, and why
/// ffmpeg could not be started when it could not be started. A caller cannot
/// tell those apart, and should not: both mean the file is not fit to keep.
pub async fn decodes(ffmpeg: &str, path: &Path) -> Result<(), String> {
    let outcome = Command::new(ffmpeg)
        .args(decode_arguments(path))
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| format!("could not start ffmpeg to check the file: {error}"))?;

    if outcome.status.success() {
        return Ok(());
    }

    Err(summarise_failure(
        &String::from_utf8_lossy(&outcome.stderr),
        SILENT_FAILURE,
    ))
}

#[cfg(test)]
mod tests {
    use super::decode_arguments;
    use std::path::Path;

    #[test]
    fn decodes_without_writing_anything() {
        let arguments = decode_arguments(Path::new("/cache/preview.mp4"));

        assert!(arguments.windows(2).any(|pair| pair == ["-f", "null"]));
        assert_eq!(arguments.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn stops_at_the_first_complaint() {
        let arguments = decode_arguments(Path::new("/cache/preview.mp4"));

        assert!(arguments.iter().any(|argument| argument == "-xerror"));
    }

    #[test]
    fn reads_the_file_it_was_given() {
        let arguments = decode_arguments(Path::new("/cache/preview.mp4"));

        assert!(arguments
            .windows(2)
            .any(|pair| pair == ["-i", "/cache/preview.mp4"]));
    }

    #[test]
    fn never_hands_the_decode_to_hardware() {
        let arguments = decode_arguments(Path::new("/cache/preview.mp4"));

        assert!(
            !arguments.iter().any(|argument| argument == "-hwaccel"),
            "checking a file with the encoder that wrote it can hide the fault"
        );
    }
}
