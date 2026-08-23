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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

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
    /// How fast it is being written, in bytes each second.
    ///
    /// What the file is growing at rather than how fast the film is being read.
    /// "Twelve times real time" means nothing to somebody watching a bar; "8
    /// MB/s" is the same figure people already read off every other transfer.
    pub bytes_per_second: Option<u64>,
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
    #[error("the download was stopped")]
    Stopped,
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
pub fn pending(id: String, progress: u8, bytes_per_second: Option<u64>) -> DownloadFile {
    DownloadFile {
        file: format!("/downloads/{id}/{DOWNLOAD_NAME}"),
        id,
        is_ready: false,
        progress,
        bytes_per_second,
        size_bytes: None,
    }
}

/// Where the parts of a download are gathered before they are joined.
const PARTS_DIRECTORY: &str = "parts";

/// How long each part runs.
///
/// A download is produced in parts rather than in one pass so that stopping it
/// keeps whatever is finished. Ten minutes is the trade: shorter parts lose less
/// when somebody pauses, and every part is another file to open, join and delete.
const PART_SECONDS: u32 = 600;

/// The list ffmpeg is given to join the parts with.
const JOIN_LIST: &str = "parts.txt";

/// The name the joined file is written under before it is finished with.
const WORKING_NAME: &str = "download.working.mp4";

/// The parts already finished, in order.
///
/// The last part ffmpeg was writing when it stopped is not finished, and is left
/// out — a part is only counted once the next one exists, because ffmpeg has no
/// way of saying "this one is complete" other than moving on to another.
pub async fn parts_done(directory: &Path) -> Vec<PathBuf> {
    let Ok(mut entries) = tokio::fs::read_dir(directory.join(PARTS_DIRECTORY)).await else {
        return Vec::new();
    };

    let mut found: Vec<PathBuf> = Vec::new();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();

        if path.extension().is_some_and(|kind| kind == "mp4") {
            found.push(path);
        }
    }

    found.sort();
    found.pop();

    found
}

/// How far into the film the finished parts reach.
#[must_use]
pub fn seconds_done(parts: usize) -> u32 {
    u32::try_from(parts)
        .unwrap_or(0)
        .saturating_mul(PART_SECONDS)
}

/// The arguments that produce the parts of a download.
///
/// Everything about the picture and the sound is the plan's own — the same
/// encoder, the same filters, the same copy-or-encode decision — so a download
/// looks exactly like what a viewer would have streamed.
///
/// What differs is that it is written in parts. One pass would be simpler and
/// would throw away an hour of work the moment anybody paused it: an MP4 is not
/// playable until its index is written at the end, so a half finished one is not
/// half a download, it is nothing. Parts are each a whole file, so stopping
/// costs at most the one being written and resuming starts at the next.
///
/// `done` is how many parts are already there, which is both where to resume
/// from and what to number the next part.
///
/// Progress is asked for on standard output rather than scraped from the log,
/// because the log format is not a contract and `-progress` is.
#[must_use]
pub fn download_arguments(
    plan: &TranscodePlan,
    request: &DownloadRequest,
    directory: &Path,
    done: usize,
) -> Vec<String> {
    let mut args = plan.to_download_args_from(seconds_done(done));

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

    args.push("-f".into());
    args.push("segment".into());
    args.push("-segment_time".into());
    args.push(PART_SECONDS.to_string());
    args.push("-segment_format".into());
    args.push("mp4".into());
    args.push("-segment_format_options".into());
    args.push("movflags=+faststart".into());
    args.push("-reset_timestamps".into());
    args.push("1".into());
    args.push("-segment_start_number".into());
    args.push(done.to_string());
    args.push("-y".into());
    args.push(
        directory
            .join(PARTS_DIRECTORY)
            .join("part%05d.mp4")
            .to_string_lossy()
            .into_owned(),
    );

    args
}

/// The arguments that join the finished parts into the file somebody keeps.
///
/// Copied rather than encoded — the parts are already what was asked for, and
/// re-encoding them would spend the whole transcode again to change nothing. The
/// index is moved to the front so a player can start the file before it has all
/// of it.
#[must_use]
pub fn join_arguments(directory: &Path) -> Vec<String> {
    vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-loglevel".into(),
        "error".into(),
        "-f".into(),
        "concat".into(),
        "-safe".into(),
        "0".into(),
        "-i".into(),
        directory.join(JOIN_LIST).to_string_lossy().into_owned(),
        "-c".into(),
        "copy".into(),
        "-movflags".into(),
        "+faststart".into(),
        "-y".into(),
        directory.join(WORKING_NAME).to_string_lossy().into_owned(),
    ]
}

/// How fast the file is growing, in bytes each second.
///
/// Nothing is claimed in the first moments: a rate measured over a fraction of a
/// second is mostly noise, and a figure that reads 400 MB/s and then settles at
/// eight is worse than no figure at all.
#[must_use]
pub fn rate(written: u64, elapsed: Duration) -> Option<u64> {
    let seconds = elapsed.as_secs_f64();

    if seconds < 1.0 || written == 0 {
        return None;
    }

    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss,
        reason = "a byte rate, floored, and never negative"
    )]
    {
        Some((written as f64 / seconds) as u64)
    }
}

/// How large ffmpeg says it has written so far.
///
/// `total_size` counts only the part being written, so what came before is added
/// back by the caller — otherwise the figure falls to nothing on every resume.
#[must_use]
pub fn written_from(line: &str) -> Option<u64> {
    line.strip_prefix("total_size=")?.trim().parse().ok()
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
/// Picks up from whatever parts are already there, so a download stopped an hour
/// in resumes an hour in rather than starting again. Stops when the caller says
/// so, leaving the finished parts where they are.
///
/// # Errors
///
/// Returns [`DownloadError`] when the directory cannot be made, ffmpeg cannot be
/// started, or it finishes having written nothing.
pub async fn generate(
    ffmpeg: &str,
    cache_root: &Path,
    plan: &TranscodePlan,
    request: &DownloadRequest,
    stop: Arc<AtomicBool>,
    told: impl Fn(u8, Option<u64>),
) -> Result<DownloadFile, DownloadError> {
    let id = request.id();
    let directory = directory_for(cache_root, &id);

    if is_complete(cache_root, &id).await {
        return Ok(ready(cache_root, &id).await);
    }

    tokio::fs::create_dir_all(directory.join(PARTS_DIRECTORY))
        .await
        .map_err(DownloadError::Directory)?;

    let already = parts_done(&directory).await.len();
    let behind = f64::from(seconds_done(already));

    let mut child = Command::new(ffmpeg)
        .args(download_arguments(plan, request, &directory, already))
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(DownloadError::Spawn)?;

    if let Some(pipe) = child.stdout.take() {
        let mut lines = BufReader::new(pipe).lines();

        let started = Instant::now();
        let mut written = 0_u64;

        while let Ok(Some(line)) = lines.next_line().await {
            if stop.load(Ordering::Relaxed) {
                let _ = child.start_kill();

                break;
            }

            if let Some(so_far) = written_from(&line) {
                written = so_far;
            }

            if let Some(done) = progress_from(&line, request.duration_seconds - behind) {
                told(
                    carried(already, request.duration_seconds, done),
                    rate(written, started.elapsed()),
                );
            }
        }
    }

    let finished = child
        .wait_with_output()
        .await
        .map_err(DownloadError::Spawn)?;

    if stop.load(Ordering::Relaxed) {
        return Err(DownloadError::Stopped);
    }

    if !finished.status.success() {
        return Err(DownloadError::NoOutput(
            String::from_utf8_lossy(&finished.stderr).trim().to_owned(),
        ));
    }

    join(ffmpeg, &directory).await?;

    Ok(ready(cache_root, &id).await)
}

/// How far through the whole film this run's own progress puts it.
///
/// ffmpeg reports how far through the part it is working on, which starts again
/// at nought on every resume. Somebody watching a download that is an hour in
/// should not see it fall back to nothing because it stopped and started.
#[must_use]
pub fn carried(done_parts: usize, duration_seconds: f64, this_run: u8) -> u8 {
    if duration_seconds <= 0.0 {
        return this_run;
    }

    let behind = f64::from(seconds_done(done_parts));
    let ahead = (duration_seconds - behind).max(0.0);
    let whole = (behind + (ahead * f64::from(this_run) / 100.0)) / duration_seconds;

    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "clamped to 0..=1 on the line above, so this is 0..=100"
    )]
    {
        (whole.clamp(0.0, 1.0) * 100.0).round() as u8
    }
}

/// Joins the finished parts into the file somebody keeps.
async fn join(ffmpeg: &str, directory: &Path) -> Result<(), DownloadError> {
    let mut parts = parts_done(directory).await;

    if let Ok(mut entries) = tokio::fs::read_dir(directory.join(PARTS_DIRECTORY)).await {
        let mut all: Vec<PathBuf> = Vec::new();

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();

            if path.extension().is_some_and(|kind| kind == "mp4") {
                all.push(path);
            }
        }

        all.sort();
        parts = all;
    }

    if parts.is_empty() {
        return Err(DownloadError::NoOutput("no parts were written".to_owned()));
    }

    let list = parts
        .iter()
        .map(|path| format!("file '{}'", path.to_string_lossy()))
        .collect::<Vec<_>>()
        .join("\n");

    tokio::fs::write(directory.join(JOIN_LIST), list)
        .await
        .map_err(DownloadError::Directory)?;

    let joined = Command::new(ffmpeg)
        .args(join_arguments(directory))
        .output()
        .await
        .map_err(DownloadError::Spawn)?;

    let working = directory.join(WORKING_NAME);

    let wrote = tokio::fs::metadata(&working)
        .await
        .is_ok_and(|found| found.len() > 0);

    if !joined.status.success() || !wrote {
        let _ = tokio::fs::remove_file(&working).await;

        return Err(DownloadError::NoOutput(
            String::from_utf8_lossy(&joined.stderr).trim().to_owned(),
        ));
    }

    tokio::fs::rename(&working, directory.join(DOWNLOAD_NAME))
        .await
        .map_err(DownloadError::Directory)?;

    let _ = tokio::fs::remove_dir_all(directory.join(PARTS_DIRECTORY)).await;
    let _ = tokio::fs::remove_file(directory.join(JOIN_LIST)).await;

    Ok(())
}

/// What to say about a download that is finished.
async fn ready(cache_root: &Path, id: &str) -> DownloadFile {
    DownloadFile {
        file: format!("/downloads/{id}/{DOWNLOAD_NAME}"),
        is_ready: true,
        progress: 100,
        bytes_per_second: None,
        size_bytes: size_of(cache_root, id).await,
        id: id.to_owned(),
    }
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

/// What is known about a preparation while it is running.
#[derive(Clone, Default)]
struct InFlight {
    progress: u8,
    bytes_per_second: Option<u64>,
    stop: Arc<AtomicBool>,
}

/// Keeps one preparation per download, however many people ask for it, and holds
/// the switch that stops each one.
#[derive(Clone, Default)]
pub struct DownloadRegistry {
    in_flight: Arc<Mutex<HashMap<String, InFlight>>>,
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

        in_flight.insert(id.to_owned(), InFlight::default());

        true
    }

    /// The switch that stops this preparation, for whoever is running it.
    pub async fn stopper(&self, id: &str) -> Arc<AtomicBool> {
        self.in_flight
            .lock()
            .await
            .get(id)
            .map_or_else(Arc::default, |held| Arc::clone(&held.stop))
    }

    /// Asks a running preparation to stop where it is.
    ///
    /// What it has finished stays on disk, so asking for it again picks up from
    /// there rather than starting the film over.
    pub async fn stop(&self, id: &str) -> bool {
        let in_flight = self.in_flight.lock().await;

        let Some(held) = in_flight.get(id) else {
            return false;
        };

        held.stop.store(true, Ordering::Relaxed);

        true
    }

    /// Records how far through a claimed download is, and how fast it is going.
    pub async fn note(&self, id: &str, progress: u8, bytes_per_second: Option<u64>) {
        let mut in_flight = self.in_flight.lock().await;

        if let Some(held) = in_flight.get_mut(id) {
            held.progress = progress;
            held.bytes_per_second = bytes_per_second;
        }
    }

    /// How far through a download is and how fast, where one is under way.
    pub async fn progress(&self, id: &str) -> Option<(u8, Option<u64>)> {
        self.in_flight
            .lock()
            .await
            .get(id)
            .map(|held| (held.progress, held.bytes_per_second))
    }

    /// Lets go of a download, whether it finished or failed.
    pub async fn release(&self, id: &str) {
        self.in_flight.lock().await.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        carried, pending, progress_from, rate, seconds_done, written_from, DownloadRegistry,
        DownloadRequest, DOWNLOAD_NAME,
    };
    use std::sync::atomic::Ordering;
    use std::time::Duration;

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
    fn measures_how_fast_the_file_is_growing() {
        assert_eq!(rate(16_000_000, Duration::from_secs(2)), Some(8_000_000));
    }

    #[test]
    fn claims_no_rate_from_the_first_moments_of_a_run() {
        assert_eq!(rate(16_000_000, Duration::from_millis(200)), None);
    }

    #[test]
    fn claims_no_rate_before_anything_has_been_written() {
        assert_eq!(rate(0, Duration::from_secs(5)), None);
    }

    #[test]
    fn reads_how_much_ffmpeg_says_it_has_written() {
        assert_eq!(written_from("total_size=1048576"), Some(1_048_576));
        assert_eq!(written_from("frame=100"), None);
    }

    #[test]
    fn counts_nothing_done_before_anything_is() {
        assert_eq!(seconds_done(0), 0);
    }

    #[test]
    fn counts_what_the_finished_parts_reach() {
        assert_eq!(seconds_done(6), 3600);
    }

    #[test]
    fn carries_what_was_already_done_into_this_run_s_own_progress() {
        assert_eq!(carried(6, 7200.0, 0), 50);
        assert_eq!(carried(6, 7200.0, 50), 75);
        assert_eq!(carried(6, 7200.0, 100), 100);
    }

    #[test]
    fn reports_a_first_run_as_its_own_progress() {
        assert_eq!(carried(0, 7200.0, 40), 40);
    }

    #[test]
    fn claims_nothing_odd_about_a_film_of_no_length() {
        assert_eq!(carried(3, 0.0, 40), 40);
    }

    #[tokio::test]
    async fn hands_the_same_switch_to_whoever_runs_a_claimed_download() {
        let registry = DownloadRegistry::new();

        registry.claim("abc").await;

        let stopper = registry.stopper("abc").await;

        assert!(!stopper.load(Ordering::Relaxed));
        assert!(registry.stop("abc").await);
        assert!(stopper.load(Ordering::Relaxed));
    }

    #[tokio::test]
    async fn says_there_was_nothing_to_stop_rather_than_pretending_there_was() {
        let registry = DownloadRegistry::new();

        assert!(!registry.stop("abc").await);
    }

    #[tokio::test]
    async fn leaves_a_new_claim_unstopped_after_an_earlier_one_was_stopped() {
        let registry = DownloadRegistry::new();

        registry.claim("abc").await;
        registry.stop("abc").await;
        registry.release("abc").await;
        registry.claim("abc").await;

        assert!(!registry.stopper("abc").await.load(Ordering::Relaxed));
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
        let waiting = pending("abc".to_owned(), 12, Some(8_000_000));

        assert_eq!(waiting.file, format!("/downloads/abc/{DOWNLOAD_NAME}"));
        assert!(!waiting.is_ready);
        assert_eq!(waiting.progress, 12);
        assert_eq!(waiting.bytes_per_second, Some(8_000_000));
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
        registry.note("abc", 42, Some(8_000_000)).await;

        assert_eq!(registry.progress("abc").await, Some((42, Some(8_000_000))));
    }

    #[tokio::test]
    async fn knows_nothing_about_a_download_nobody_claimed() {
        let registry = DownloadRegistry::new();

        registry.note("abc", 42, None).await;

        assert_eq!(registry.progress("abc").await, None);
    }
}
