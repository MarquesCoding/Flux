use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use thiserror::Error;
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

use crate::transcode_plan::{SessionSpec, TranscodePlan, MANIFEST_NAME};

/// Written only when ffmpeg exits cleanly.
///
/// A finished playlist is not proof of a usable transcode: an interrupted run
/// can leave an `#EXT-X-ENDLIST` from a previous attempt beside a zero length
/// initialisation segment. Only the process's own exit status can say the
/// output is whole, so completion is recorded rather than inferred.
const COMPLETE_MARKER: &str = ".complete";

/// Reports whether a session directory already holds a finished transcode.
///
/// Segments are content addressed, so the same request after a restart lands
/// on a directory that may already be complete. Re-running ffmpeg over it
/// wastes the work and truncates a playlist a client may be reading.
async fn is_already_complete(directory: &Path) -> bool {
    tokio::fs::try_exists(directory.join(COMPLETE_MARKER))
        .await
        .unwrap_or(false)
}

/// Why a session could not be started.
#[derive(Debug, Error)]
pub enum SessionError {
    #[error("could not create the session directory: {0}")]
    Directory(std::io::Error),
    #[error("could not start ffmpeg: {0}")]
    Spawn(std::io::Error),
    #[error("ffmpeg exited immediately with status {status}: {stderr}")]
    Rejected { status: i32, stderr: String },
}

/// Messages that mean the hardware encoder, rather than the file, is the
/// problem.
const HARDWARE_MARKERS: [&str; 7] = [
    "cannot load libcuda",
    "no device available",
    "device creation failed",
    "failed to initialise",
    "failed to initialize",
    "openencodesessionex failed",
    "impossible to convert between",
];

/// How a session ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitClass {
    /// Finished writing every segment.
    Completed,
    /// The hardware encoder failed. Worth one software retry.
    HardwareFailure,
    /// The input is unusable. Retrying changes nothing.
    InputError,
    /// Stopped on request.
    Cancelled,
}

/// Classifies an ffmpeg exit.
///
/// Distinguishing hardware failure from a bad file is what makes the automatic
/// software retry safe: retrying a corrupt file in software just burns CPU and
/// fails again, while a busy or broken GPU is worth one more attempt.
#[must_use]
pub fn classify_exit(status: Option<i32>, stderr: &str) -> ExitClass {
    if status == Some(0) {
        return ExitClass::Completed;
    }

    if status.is_none() {
        return ExitClass::Cancelled;
    }

    let lowered = stderr.to_lowercase();

    if HARDWARE_MARKERS
        .iter()
        .any(|marker| lowered.contains(marker))
    {
        return ExitClass::HardwareFailure;
    }

    ExitClass::InputError
}

/// A running transcode.
#[derive(Debug)]
pub struct Session {
    pub id: String,
    pub directory: PathBuf,
    pub spec: SessionSpec,
    cancel: Option<oneshot::Sender<()>>,
    last_touched: Instant,
}

impl Session {
    /// The manifest this session writes.
    #[must_use]
    pub fn manifest_path(&self) -> PathBuf {
        self.directory.join(MANIFEST_NAME)
    }

    /// Marks the session as recently used, delaying idle collection.
    pub fn touch(&mut self) {
        self.last_touched = Instant::now();
    }

    /// How long since anything asked for this session.
    #[must_use]
    pub fn idle_for(&self) -> Duration {
        self.last_touched.elapsed()
    }

    /// Stops the transcode, if it is still running.
    ///
    /// An ffmpeg process outliving the client that asked for it is the classic
    /// resource leak in this kind of software, so sessions are cancelled
    /// explicitly rather than left to finish.
    pub fn stop(&mut self) {
        if let Some(cancel) = self.cancel.take() {
            let _ = cancel.send(());
        }
    }
}

/// Where sessions live and how long they survive unused.
#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub ffmpeg: String,
    pub cache_root: PathBuf,
    pub idle_timeout: Duration,
    pub max_concurrent: usize,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            ffmpeg: "ffmpeg".to_owned(),
            cache_root: std::env::temp_dir().join("flux-transcodes"),
            idle_timeout: Duration::from_secs(300),
            max_concurrent: 2,
        }
    }
}

/// The set of live sessions.
#[derive(Debug, Clone)]
pub struct SessionRegistry {
    config: SessionConfig,
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl SessionRegistry {
    #[must_use]
    pub fn new(config: SessionConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    #[must_use]
    pub fn config(&self) -> &SessionConfig {
        &self.config
    }

    /// Starts a session, or returns the existing one for the same
    /// specification.
    ///
    /// Reuse is the point of content addressed identifiers: a client that
    /// reconnects, or a second client asking for exactly the same output, joins
    /// the running transcode instead of starting a competing one.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError`] when the directory cannot be made, ffmpeg
    /// cannot be spawned, or ffmpeg rejects the input immediately.
    pub async fn start(&self, spec: SessionSpec) -> Result<String, SessionError> {
        let id = spec.session_id();

        {
            let mut sessions = self.sessions.lock().await;

            if let Some(existing) = sessions.get_mut(&id) {
                existing.touch();

                return Ok(id);
            }
        }

        self.collect_idle().await;

        let directory = self.config.cache_root.join(&id);

        tokio::fs::create_dir_all(&directory)
            .await
            .map_err(SessionError::Directory)?;

        if is_already_complete(&directory).await {
            let mut sessions = self.sessions.lock().await;

            sessions.insert(
                id.clone(),
                Session {
                    id: id.clone(),
                    directory,
                    spec,
                    cancel: None,
                    last_touched: Instant::now(),
                },
            );

            return Ok(id);
        }

        let plan = TranscodePlan {
            spec: spec.clone(),
            output_directory: directory.to_string_lossy().into_owned(),
        };

        drop(spawn_ffmpeg(&self.config.ffmpeg, &plan)?);

        let (cancel_tx, cancel_rx) = oneshot::channel();
        let config = self.config.clone();
        let supervised = plan.clone();

        tokio::spawn(async move { supervise(config, supervised, cancel_rx).await });

        let mut sessions = self.sessions.lock().await;

        sessions.insert(
            id.clone(),
            Session {
                id: id.clone(),
                directory,
                spec,
                cancel: Some(cancel_tx),
                last_touched: Instant::now(),
            },
        );

        Ok(id)
    }

    /// Reports the directory of a session and marks it as used.
    #[must_use]
    pub async fn touch(&self, id: &str) -> Option<PathBuf> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions.get_mut(id)?;

        session.touch();

        Some(session.directory.clone())
    }

    /// Stops and forgets a session, leaving its segments on disk.
    pub async fn stop(&self, id: &str) -> bool {
        let mut sessions = self.sessions.lock().await;

        match sessions.remove(id) {
            None => false,
            Some(mut session) => {
                session.stop();

                true
            }
        }
    }

    /// How many sessions are currently tracked.
    pub async fn len(&self) -> usize {
        self.sessions.lock().await.len()
    }

    /// Whether no sessions are tracked.
    pub async fn is_empty(&self) -> bool {
        self.len().await == 0
    }

    /// Stops sessions nothing has asked about for longer than the timeout.
    ///
    /// A browser tab closed mid-playback sends no notification, so idle
    /// collection is the backstop that keeps a closed tab from holding a
    /// transcode open indefinitely.
    pub async fn collect_idle(&self) -> usize {
        let timeout = self.config.idle_timeout;
        let mut sessions = self.sessions.lock().await;

        let stale: Vec<String> = sessions
            .iter()
            .filter(|(_, session)| session.idle_for() > timeout)
            .map(|(id, _)| id.clone())
            .collect();

        for id in &stale {
            if let Some(mut session) = sessions.remove(id) {
                session.stop();
            }
        }

        stale.len()
    }

    /// Stops every session.
    pub async fn stop_all(&self) {
        let mut sessions = self.sessions.lock().await;

        for session in sessions.values_mut() {
            session.stop();
        }

        sessions.clear();
    }
}

/// Runs one ffmpeg attempt to completion, or until cancelled.
async fn run_attempt(
    ffmpeg: &str,
    plan: &TranscodePlan,
    cancel: &mut oneshot::Receiver<()>,
) -> ExitClass {
    let Ok(child) = spawn_ffmpeg(ffmpeg, plan) else {
        return ExitClass::InputError;
    };

    let waiting = child.wait_with_output();
    tokio::pin!(waiting);

    tokio::select! {
        biased;

        _ = &mut *cancel => ExitClass::Cancelled,

        finished = &mut waiting => match finished {
            Err(_) => ExitClass::InputError,
            Ok(output) => classify_exit(
                output.status.code(),
                &String::from_utf8_lossy(&output.stderr),
            ),
        },
    }
}

/// Supervises a transcode from start to finish.
///
/// A hardware encoder that fails is retried once in software. A busy or broken
/// GPU should mean a slower film, not a dead player. A bad input is not
/// retried: retrying it in software just burns CPU and fails again. See
/// ADR-0009.
async fn supervise(config: SessionConfig, plan: TranscodePlan, mut cancel: oneshot::Receiver<()>) {
    let directory = PathBuf::from(&plan.output_directory);
    let mut attempt = plan;

    for _ in 0..2 {
        let outcome = run_attempt(&config.ffmpeg, &attempt, &mut cancel).await;

        if outcome == ExitClass::Completed {
            let _ = tokio::fs::write(directory.join(COMPLETE_MARKER), b"ok").await;

            return;
        }

        if outcome != ExitClass::HardwareFailure || !attempt.spec.uses_hardware() {
            return;
        }

        attempt = TranscodePlan {
            spec: attempt.spec.without_hardware(),
            output_directory: attempt.output_directory,
        };
    }
}

fn spawn_ffmpeg(ffmpeg: &str, plan: &TranscodePlan) -> Result<tokio::process::Child, SessionError> {
    let child = Command::new(ffmpeg)
        .args(plan.to_ffmpeg_args())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(SessionError::Spawn)?;

    Ok(child)
}

/// Waits for a manifest to appear.
///
/// HLS playback cannot begin until ffmpeg has written the playlist, which
/// takes a moment after the process starts. Callers wait rather than returning
/// a 404 that the client would have to poll around.
#[must_use]
pub async fn await_manifest(path: &Path, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if tokio::fs::try_exists(path).await.unwrap_or(false) {
            return true;
        }

        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::{classify_exit, ExitClass, SessionConfig, SessionRegistry};

    #[test]
    fn a_clean_exit_is_completion() {
        assert_eq!(classify_exit(Some(0), ""), ExitClass::Completed);
    }

    #[test]
    fn no_status_means_it_was_killed() {
        assert_eq!(classify_exit(None, ""), ExitClass::Cancelled);
    }

    #[test]
    fn recognises_a_missing_hardware_device() {
        assert_eq!(
            classify_exit(Some(1), "No device available for encoder"),
            ExitClass::HardwareFailure
        );
    }

    #[test]
    fn recognises_a_failed_hardware_context() {
        assert_eq!(
            classify_exit(Some(1), "Device creation failed: -12"),
            ExitClass::HardwareFailure
        );
    }

    #[test]
    fn treats_an_unreadable_file_as_an_input_error() {
        assert_eq!(
            classify_exit(Some(1), "moov atom not found"),
            ExitClass::InputError
        );
    }

    #[test]
    fn matches_hardware_markers_regardless_of_case() {
        assert_eq!(
            classify_exit(Some(1), "CANNOT LOAD LIBCUDA.SO.1"),
            ExitClass::HardwareFailure
        );
    }

    #[tokio::test]
    async fn a_new_registry_has_no_sessions() {
        let registry = SessionRegistry::new(SessionConfig::default());

        assert!(registry.is_empty().await);
    }

    #[tokio::test]
    async fn stopping_an_unknown_session_reports_nothing_to_stop() {
        let registry = SessionRegistry::new(SessionConfig::default());

        assert!(!registry.stop("does-not-exist").await);
    }

    #[tokio::test]
    async fn touching_an_unknown_session_reports_nothing() {
        let registry = SessionRegistry::new(SessionConfig::default());

        assert!(registry.touch("does-not-exist").await.is_none());
    }
}
