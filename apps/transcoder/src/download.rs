//! Whole files, prepared for keeping.
//!
//! Everything else here is delivered as segments a player pulls as it goes,
//! which is the right shape for watching and the wrong one for keeping: a
//! folder of four second chunks and a playlist is not something anybody can put
//! on a plane. A download is one progressive MP4 with its index at the front,
//! so it plays in whatever the device already has.
//!
//! The work is the same work a session does — the same encoder, the same
//! filters, the same decisions about what can be copied — so the arguments are
//! built from the same [`TranscodePlan`] rather than assembled again here. What
//! differs is the muxer, and what gets carried: a session sends one audio track
//! and leaves subtitles to a sidecar, where a file somebody keeps should hold
//! every track they might want, because there is nowhere to fetch a missing one
//! from at thirty thousand feet.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::transcode_plan::{SessionSpec, TranscodePlan};

/// The file a prepared download is written to.
pub const DOWNLOAD_NAME: &str = "download.mp4";

/// What a download is asked for.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    /// How the file should be produced, decided the same way a session's is.
    ///
    /// A spec rather than a whole plan: which card to open and which filters
    /// the build has are facts about this machine, not about the download, and
    /// a caller on the other side of a socket has no business knowing them.
    pub spec: SessionSpec,
    /// How long the film runs, so progress can be a fraction rather than a clock.
    pub duration_seconds: f64,
    /// Which audio streams to carry, as ffprobe numbers them.
    ///
    /// Every one asked for is written. A session sends one because a player can
    /// ask for another; a kept file cannot, so the choice is made once, here.
    #[serde(default)]
    pub audio_stream_indexes: Vec<u32>,
    /// Which subtitle streams to carry, as ffprobe numbers them.
    ///
    /// Text only. Bitmap subtitles cannot be muxed into MP4 at all, and a
    /// caller that sends one gets a file that would not have been written.
    #[serde(default)]
    pub subtitle_stream_indexes: Vec<u32>,
    /// What the library thinks this file is, so a changed file prepares afresh.
    #[serde(default)]
    pub generation: u32,
}

impl DownloadRequest {
    /// What to call this download on disk.
    ///
    /// Derived from everything that changes the bytes, so two devices asking
    /// for the same rendition share one file and a device asking for a
    /// different one gets its own.
    #[must_use]
    pub fn id(&self) -> String {
        let mut digest = Sha256::new();

        digest.update(self.spec.summary().as_bytes());
        digest.update(self.spec.input_path.as_bytes());
        digest.update(self.generation.to_le_bytes());

        for index in &self.audio_stream_indexes {
            digest.update(index.to_le_bytes());
        }

        for index in &self.subtitle_stream_indexes {
            digest.update(index.to_le_bytes());
        }

        format!("{:x}", digest.finalize())
    }
}

/// Where a download has got to.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFile {
    pub id: String,
    pub is_ready: bool,
    /// How far through, from nought to one.
    pub progress: u8,
    /// Where to fetch it once it is ready.
    pub file: String,
    /// How large it turned out, once there is a file to measure.
    pub size_bytes: Option<u64>,
}

/// What can go wrong preparing one.
#[derive(Debug, Error)]
pub enum DownloadError {
    #[error("the download directory could not be made: {0}")]
    Directory(std::io::Error),
    #[error("ffmpeg could not be started: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg wrote no file: {0}")]
    NoOutput(String),
}

/// Where a prepared download lives.
#[must_use]
pub fn directory_for(cache_root: &Path, id: &str) -> PathBuf {
    cache_root.join("downloads").join(id)
}

/// Whether this download has already been prepared in full.
///
/// A file is only complete once ffmpeg has finished with it, so preparation
/// writes to a working name and renames at the end. Anything else would let a
/// half written file be served as though it were the whole thing.
pub async fn is_complete(cache_root: &Path, id: &str) -> bool {
    tokio::fs::metadata(directory_for(cache_root, id).join(DOWNLOAD_NAME))
        .await
        .is_ok_and(|found| found.len() > 0)
}

/// How large the prepared file is, where there is one.
pub async fn size_of(cache_root: &Path, id: &str) -> Option<u64> {
    tokio::fs::metadata(directory_for(cache_root, id).join(DOWNLOAD_NAME))
        .await
        .ok()
        .map(|found| found.len())
}

/// What to say about a download nobody has finished preparing yet.
#[must_use]
pub fn pending(id: String, progress: u8) -> DownloadFile {
    DownloadFile {
        file: format!("/downloads/{id}/{DOWNLOAD_NAME}"),
        id,
        is_ready: false,
        progress,
        size_bytes: None,
    }
}

/// The name ffmpeg writes to while it is still working.
const WORKING_NAME: &str = "download.working.mp4";

/// The arguments that turn a session's plan into one progressive file.
///
/// Everything about the picture and the sound is the plan's own — the same
/// encoder, the same filters, the same copy-or-encode decision — so a download
/// looks exactly like what a viewer would have streamed. Only the tail differs:
/// one MP4 rather than a folder of segments, with the index moved to the front
/// so a player can start it before it has the whole file.
///
/// Progress is asked for on standard output rather than scraped from the log,
/// because the log format is not a contract and `-progress` is.
#[must_use]
pub fn download_arguments(
    plan: &TranscodePlan,
    request: &DownloadRequest,
    directory: &Path,
) -> Vec<String> {
    let mut args = plan.to_download_args();

    args.push("-progress".into());
    args.push("pipe:1".into());

    for index in &request.subtitle_stream_indexes {
        args.push("-map".into());
        args.push(format!("0:{index}"));
    }

    if !request.subtitle_stream_indexes.is_empty() {
        args.push("-c:s".into());
        args.push("mov_text".into());
    }

    args.push("-movflags".into());
    args.push("+faststart".into());
    args.push("-f".into());
    args.push("mp4".into());
    args.push("-y".into());
    args.push(directory.join(WORKING_NAME).to_string_lossy().into_owned());

    args
}

/// How far through ffmpeg says it is, as a percentage.
///
/// `-progress` writes `out_time_us` on its own line every second. Anything else
/// on the pipe is ignored rather than parsed, so a future ffmpeg adding a field
/// does not stop this reading the one it came for.
#[must_use]
pub fn progress_from(line: &str, duration_seconds: f64) -> Option<u8> {
    let micros: f64 = line.strip_prefix("out_time_us=")?.trim().parse().ok()?;

    if duration_seconds <= 0.0 {
        return None;
    }

    let percent = (((micros / 1_000_000.0) / duration_seconds).clamp(0.0, 1.0) * 100.0).round();

    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "clamped to 0..=1 on the line above, so this is 0..=100"
    )]
    Some(percent as u8)
}

/// Prepares the file, reporting how far through it is as it goes.
///
/// # Errors
///
/// Returns [`DownloadError`] when the directory cannot be made, ffmpeg cannot
/// be started, or it finishes having written nothing.
pub async fn generate(
    ffmpeg: &str,
    cache_root: &Path,
    plan: &TranscodePlan,
    request: &DownloadRequest,
    told: impl Fn(u8),
) -> Result<DownloadFile, DownloadError> {
    let id = request.id();
    let directory = directory_for(cache_root, &id);

    if is_complete(cache_root, &id).await {
        return Ok(DownloadFile {
            file: format!("/downloads/{id}/{DOWNLOAD_NAME}"),
            is_ready: true,
            progress: 100,
            size_bytes: size_of(cache_root, &id).await,
            id,
        });
    }

    tokio::fs::create_dir_all(&directory)
        .await
        .map_err(DownloadError::Directory)?;

    let mut child = Command::new(ffmpeg)
        .args(download_arguments(plan, request, &directory))
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(DownloadError::Spawn)?;

    if let Some(pipe) = child.stdout.take() {
        let mut lines = BufReader::new(pipe).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(done) = progress_from(&line, request.duration_seconds) {
                told(done);
            }
        }
    }

    let finished = child
        .wait_with_output()
        .await
        .map_err(DownloadError::Spawn)?;

    let working = directory.join(WORKING_NAME);

    let wrote = tokio::fs::metadata(&working)
        .await
        .is_ok_and(|found| found.len() > 0);

    if !finished.status.success() || !wrote {
        let _ = tokio::fs::remove_file(&working).await;

        return Err(DownloadError::NoOutput(
            String::from_utf8_lossy(&finished.stderr).trim().to_owned(),
        ));
    }

    tokio::fs::rename(&working, directory.join(DOWNLOAD_NAME))
        .await
        .map_err(DownloadError::Directory)?;

    Ok(DownloadFile {
        file: format!("/downloads/{id}/{DOWNLOAD_NAME}"),
        is_ready: true,
        progress: 100,
        size_bytes: size_of(cache_root, &id).await,
        id,
    })
}

/// Forgets a prepared download, so its disk can be used for something else.
///
/// # Errors
///
/// Returns the underlying error where the directory exists and cannot be
/// removed. A directory that was never there is not a failure.
pub async fn forget(cache_root: &Path, id: &str) -> std::io::Result<()> {
    match tokio::fs::remove_dir_all(directory_for(cache_root, id)).await {
        Err(failure) if failure.kind() == std::io::ErrorKind::NotFound => Ok(()),
        outcome => outcome,
    }
}

/// Keeps one preparation per download, however many people ask for it.
#[derive(Clone, Default)]
pub struct DownloadRegistry {
    in_flight: Arc<Mutex<HashMap<String, u8>>>,
}

impl DownloadRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Takes this download to prepare, unless something already has.
    ///
    /// A download runs for minutes, and the client asks how it is going every
    /// few seconds. Without a claim taken before anything is spawned, every ask
    /// would start another encode of the same film.
    pub async fn claim(&self, id: &str) -> bool {
        let mut in_flight = self.in_flight.lock().await;

        if in_flight.contains_key(id) {
            return false;
        }

        in_flight.insert(id.to_owned(), 0);

        true
    }

    /// Records how far through a claimed download is.
    pub async fn note(&self, id: &str, progress: u8) {
        let mut in_flight = self.in_flight.lock().await;

        if let Some(held) = in_flight.get_mut(id) {
            *held = progress;
        }
    }

    /// How far through a download is, where one is under way.
    pub async fn progress(&self, id: &str) -> Option<u8> {
        self.in_flight.lock().await.get(id).copied()
    }

    /// Lets go of a download, whether it finished or failed.
    pub async fn release(&self, id: &str) {
        self.in_flight.lock().await.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::{pending, progress_from, DownloadRegistry, DownloadRequest, DOWNLOAD_NAME};

    /// The exact shape the server sends, which is where the names have to agree.
    const AS_THE_SERVER_SENDS_IT: &str = r#"{
        "spec": {
            "inputPath": "/media/film.mkv",
            "startSeconds": 0,
            "segmentSeconds": 4,
            "hardwareAccel": "none",
            "video": { "kind": "copy" },
            "audio": { "kind": "copy" }
        },
        "durationSeconds": 7200.0,
        "audioStreamIndexes": [1, 2],
        "subtitleStreamIndexes": [3],
        "generation": 7
    }"#;

    #[test]
    fn reads_a_request_written_the_way_the_server_writes_it() {
        let asked: DownloadRequest =
            serde_json::from_str(AS_THE_SERVER_SENDS_IT).expect("the server's own shape parses");

        assert!((asked.duration_seconds - 7200.0).abs() < f64::EPSILON);
        assert_eq!(asked.audio_stream_indexes, vec![1, 2]);
        assert_eq!(asked.subtitle_stream_indexes, vec![3]);
        assert_eq!(asked.generation, 7);
        assert_eq!(asked.spec.input_path, "/media/film.mkv");
    }

    #[test]
    fn asks_for_a_different_file_when_the_tracks_differ() {
        let one: DownloadRequest = serde_json::from_str(AS_THE_SERVER_SENDS_IT).expect("parses");

        let mut other = one.clone();

        other.audio_stream_indexes = vec![1];

        assert_ne!(one.id(), other.id());
    }

    #[test]
    fn asks_for_the_same_file_when_nothing_that_changes_the_bytes_differs() {
        let one: DownloadRequest = serde_json::from_str(AS_THE_SERVER_SENDS_IT).expect("parses");
        let two: DownloadRequest = serde_json::from_str(AS_THE_SERVER_SENDS_IT).expect("parses");

        assert_eq!(one.id(), two.id());
    }

    #[test]
    fn prepares_afresh_when_the_library_says_the_file_changed() {
        let one: DownloadRequest = serde_json::from_str(AS_THE_SERVER_SENDS_IT).expect("parses");

        let mut other = one.clone();

        other.generation = 8;

        assert_ne!(one.id(), other.id());
    }

    #[test]
    fn reads_how_far_through_ffmpeg_says_it_is() {
        assert_eq!(progress_from("out_time_us=3600000000", 7200.0), Some(50));
    }

    #[test]
    fn ignores_every_other_line_rather_than_failing_on_it() {
        assert_eq!(progress_from("frame=1024", 7200.0), None);
        assert_eq!(progress_from("speed=1.02x", 7200.0), None);
    }

    #[test]
    fn never_reports_more_than_finished() {
        assert_eq!(progress_from("out_time_us=9000000000", 7200.0), Some(100));
    }

    #[test]
    fn claims_nothing_about_a_film_of_no_length() {
        assert_eq!(progress_from("out_time_us=3600000000", 0.0), None);
    }

    #[test]
    fn names_the_file_a_pending_download_will_become() {
        let waiting = pending("abc".to_owned(), 12);

        assert_eq!(waiting.file, format!("/downloads/abc/{DOWNLOAD_NAME}"));
        assert!(!waiting.is_ready);
        assert_eq!(waiting.progress, 12);
    }

    #[tokio::test]
    async fn lets_one_preparation_through_and_turns_the_rest_away() {
        let registry = DownloadRegistry::new();

        assert!(registry.claim("abc").await);
        assert!(!registry.claim("abc").await);

        registry.release("abc").await;

        assert!(registry.claim("abc").await);
    }

    #[tokio::test]
    async fn remembers_how_far_through_a_claimed_download_is() {
        let registry = DownloadRegistry::new();

        registry.claim("abc").await;
        registry.note("abc", 42).await;

        assert_eq!(registry.progress("abc").await, Some(42));
    }

    #[tokio::test]
    async fn knows_nothing_about_a_download_nobody_claimed() {
        let registry = DownloadRegistry::new();

        registry.note("abc", 42).await;

        assert_eq!(registry.progress("abc").await, None);
    }
}
