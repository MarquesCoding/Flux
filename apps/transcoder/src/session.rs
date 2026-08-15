use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use thiserror::Error;
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex, Notify};

use crate::boundaries::ensure_boundaries;
use crate::playlist::segment_at;
use crate::transcode_plan::{
    DeviceFilters, SegmentStart, SessionSpec, TranscodePlan, VideoAction, MANIFEST_NAME,
    RUN_PLAYLIST_NAME,
};

/// Written only when ffmpeg exits cleanly.
///
/// A finished playlist is not proof of a usable transcode: an interrupted run
/// can leave an `#EXT-X-ENDLIST` from a previous attempt beside a zero length
/// initialisation segment. Only the process's own exit status can say the
/// output is whole, so completion is recorded rather than inferred.
pub const COMPLETE_MARKER: &str = ".complete";

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

/// Which devices have played a transcode, and when each last did.
///
/// Kept beside the segments rather than in memory so it survives a restart:
/// the whole point is to know which transcode a device would come back to,
/// and a service that forgets that on every deploy would evict the one
/// directory somebody was about to resume.
pub const DEVICES_MARKER: &str = ".devices";

/// Records that a device has just played this transcode.
///
/// The device is not part of the session's address, deliberately. Two people
/// watching the same thing at the same quality should share one directory and
/// one encode — what differs is that each of them would resume it, so both are
/// written here and either keeps it alive.
async fn record_device(directory: &Path, device: &str) {
    let path = directory.join(DEVICES_MARKER);

    let mut devices: HashMap<String, u64> = tokio::fs::read_to_string(&path)
        .await
        .ok()
        .and_then(|found| serde_json::from_str(&found).ok())
        .unwrap_or_default();

    devices.insert(device.to_owned(), crate::queue::now_ms());

    if let Ok(payload) = serde_json::to_string(&devices) {
        let _ = tokio::fs::write(&path, payload).await;
    }
}

/// Records that a finished transcode has been wanted again.
///
/// Rewrites the completion marker, so its timestamp says when somebody last
/// played this rather than when it was made. Eviction reads that timestamp:
/// without this, an item replayed every night would age out while one watched
/// once survives for being newer, which is exactly backwards.
///
/// Failing to record it costs a replay of a transcode later, so a marker that
/// cannot be rewritten is not worth refusing to play over.
async fn mark_used(directory: &Path) {
    let _ = tokio::fs::write(directory.join(COMPLETE_MARKER), b"ok").await;
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
    #[error("could not work out where {0} can be cut")]
    Boundaries(String),
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
    /// ffmpeg died on its own — an assertion, a segfault, the OOM killer.
    ///
    /// Kept apart from `HardwareFailure` because the two want different
    /// messages. "The encoder would not open" is a configuration an operator
    /// can act on; "ffmpeg was killed by a signal" is a crash, and which one
    /// they are reading decides where they look next.
    Crashed,
    /// Stopped on request.
    Cancelled,
}

/// How many lines of ffmpeg's own output to print when a transcode fails.
///
/// The last ones: ffmpeg opens with pages of build configuration and closes
/// with the reason it gave up.
const FFMPEG_LINES: usize = 20;

/// The end of a block of output, which is where a failure explains itself.
fn tail_of(text: &str, lines: usize) -> String {
    let all: Vec<&str> = text.lines().collect();

    all[all.len().saturating_sub(lines)..].join("\n")
}

/// Classifies an ffmpeg exit.
///
/// Distinguishing hardware failure from a bad file is what makes the automatic
/// software retry safe: retrying a corrupt file in software just burns CPU and
/// fails again, while a busy or broken GPU is worth one more attempt.
///
/// No exit code means a signal killed the process, and that is a crash rather
/// than a cancellation — a cancelled attempt never reaches here, because
/// `run_attempt` takes it off the cancel channel before the process is waited
/// on. Reading a signal death as cancellation cost both the software retry and
/// the log entry, so an aborted transcode ended the session in silence. Seen on
/// an RX 580, where the on-device subtitle chain aborted inside the VAAPI
/// encoder about one run in eight. See FLUX-112.
#[must_use]
pub fn classify_exit(status: Option<i32>, stderr: &str) -> ExitClass {
    if status == Some(0) {
        return ExitClass::Completed;
    }

    if status.is_none() {
        return ExitClass::Crashed;
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
    /// What a run of this session is built from.
    ///
    /// Kept because a run is started more than once: a viewer seeking away
    /// from where the transcode has got to is answered by stopping it and
    /// starting another at the segment they asked for, which is the same plan
    /// pointed somewhere else.
    plan: TranscodePlan,
    cancel: Option<oneshot::Sender<()>>,
    /// Which segment the live run was started at, if one is running.
    ///
    /// Where the run began rather than where it has got to: how far it has got
    /// is written in its own playlist, and a number held in memory would be a
    /// second answer to a question the disk already answers.
    running_from: Option<u64>,
    last_touched: Instant,
    /// The highest numbered segment this session has handed out.
    ///
    /// Shared with the transcode that is writing them, so it can tell how far
    /// ahead of the viewer it has got. Atomic rather than behind the registry's
    /// lock because the transcode reads it on a timer and the segment handler
    /// writes it on every fetch, and neither should wait on the other.
    reached: Arc<AtomicU64>,
    /// Told whenever a viewer asks for something.
    ///
    /// The throttle pauses a run that is further ahead than anyone is watching
    /// and looks again on a timer, so a viewer arriving at the edge of a paused
    /// transcode waited up to a whole interval for it to notice. A request is
    /// the news that the gap has closed, so it says so rather than letting the
    /// tick discover it.
    woken: Arc<Notify>,
    /// How many viewers are holding this session open.
    ///
    /// A session is addressed by what it produces, so everyone watching the
    /// same film at the same quality is holding the same one. Counting them is
    /// what stops one viewer closing their tab from taking the transcode away
    /// from the others. See ADR-0011.
    holders: usize,
    /// Where every segment of this film begins and ends.
    lengths: Arc<Vec<f64>>,
    /// The segment most recently asked for.
    ///
    /// Which viewer the transcode is for. A request that has been abandoned —
    /// the viewer scrubbed on, but its wait has not run out — must not drag
    /// the run back to where it was: two requests far apart otherwise restart
    /// each other for as long as they both last. Measured in one scrubbing
    /// session: 1750 runs, the last dozen alternating between segment 355 and
    /// segment 570, with both requests refused in the end.
    last_wanted: u64,
}

impl Session {
    /// The manifest this session serves.
    #[must_use]
    pub fn manifest_path(&self) -> PathBuf {
        self.directory.join(MANIFEST_NAME)
    }

    /// Marks the session as recently used, delaying idle collection.
    pub fn touch(&mut self) {
        self.last_touched = Instant::now();
    }

    /// Marks the session as recently used.
    ///
    /// The heartbeat, not segment fetching, is the authoritative liveness
    /// signal: it arrives on a fixed interval regardless of play state, so a
    /// paused-but-open tab keeps a session alive the same way a playing one
    /// does. Play state itself is presence's concern now, not the
    /// transcoder's — accepted here only to keep the wire format the client
    /// already sends, and otherwise unused.
    pub fn heartbeat(&mut self, _is_playing: bool) {
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
        self.running_from = None;

        if let Some(cancel) = self.cancel.take() {
            let _ = cancel.send(());
        }
    }
}

/// The encoder used when a source cannot be copied after all.
///
/// Software H.264, because this is a correctness backstop rather than a
/// considered choice: the server picks encoders from the client's profile and
/// the machine's capabilities, and it has already been told this stream would
/// be copied. Every browser plays H.264, so a film that would otherwise not
/// play at all does.
const FALLBACK_ENCODER: &str = "libx264";

/// The spec that can actually be delivered.
///
/// The keyframes have just been read, and if they say this source cannot be cut
/// into segments a player will take then copying it is not an option, however
/// it was asked for. Encoding puts a keyframe on every boundary, so the
/// segments come out the length that was asked for and every one of them is a
/// place a decoder can start.
///
/// A source that cannot be probed a second time is left as it was asked for.
/// That is the state Flux was in before any of this, so it is no worse, and
/// refusing to play over it would be.
async fn deliverable(config: &SessionConfig, spec: SessionSpec, can_copy: bool) -> SessionSpec {
    if can_copy {
        return spec;
    }

    match crate::probe::probe_media(&config.ffprobe, Path::new(&spec.input_path)).await {
        Ok(probe) => encode_instead(spec, &probe),
        Err(_) => spec,
    }
}

/// Turns a copy into an encode of the same picture.
///
/// Only reached when the source's own keyframes cannot produce deliverable
/// segments. Every limit is taken from the source, which is safe because the
/// server only asked for a copy after deciding the source already satisfied
/// the client: its size, its bitrate and its range were all acceptable, so an
/// encode that matches them is acceptable too.
///
/// The session keeps the id it was addressed by. The request has not changed —
/// only what has to be done to answer it — and the substitution is the same
/// every time, so the directory stays stable across restarts.
fn encode_instead(spec: SessionSpec, probe: &crate::media::MediaProbe) -> SessionSpec {
    let video = probe.video.as_ref();

    let (max_width, max_height) = spec
        .source_size
        .or_else(|| video.map(|stream| (stream.width, stream.height)))
        .unwrap_or((1920, 1080));

    let max_bitrate_kbps = video
        .and_then(|stream| stream.bitrate_kbps)
        .or(probe.bitrate_kbps)
        .unwrap_or(8_000);

    SessionSpec {
        video: VideoAction::Encode {
            encoder: FALLBACK_ENCODER.to_owned(),
            max_bitrate_kbps,
            max_width,
            max_height,
            tone_map: None,
        },
        ..spec
    }
}

/// Where a run of the transcode began and how far it has got.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunPosition {
    /// The segment the run was started at.
    pub from: u64,
    /// The last segment it has finished, if it has finished any.
    pub head: Option<u64>,
}

impl RunPosition {
    /// The furthest segment this run can be said to have reached.
    ///
    /// A run that has written nothing yet is treated as being where it began,
    /// so the segment it was started for is waited for rather than taken as a
    /// reason to start the run over.
    #[must_use]
    fn reached(self) -> u64 {
        self.head.unwrap_or(self.from)
    }
}

/// What to do about a segment somebody has asked for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SegmentPlan {
    /// It is on disk and whole.
    Serve,
    /// A run is coming to it. Ask again shortly.
    Wait,
    /// Nothing is going to produce it. Start a run there.
    StartAt(u64),
}

/// How far ahead of the transcode a viewer may ask before it is restarted.
///
/// Jellyfin's number, in seconds of film rather than segments so that it means
/// the same thing whatever length was asked for. Nearer than this and waiting
/// is quicker than starting again; further, and the transcode would have to
/// walk through everything in between to reach what was asked for.
const RESTART_AHEAD_SECONDS: u64 = 24;

/// How many segments ahead that is.
fn restart_gap(segment_seconds: u32) -> u64 {
    (RESTART_AHEAD_SECONDS / u64::from(segment_seconds.max(1))).max(1)
}

/// Decides how a request for a segment is answered.
///
/// This is `DynamicHlsController`'s rule and it is the whole delivery model:
/// one transcode walks forward through the film, a viewer near it waits, and a
/// viewer who has gone somewhere else gets a run started where they are. A
/// segment is never produced on its own, and a seek is never a new session.
#[must_use]
pub fn resolve_segment(
    is_ready: bool,
    run: Option<RunPosition>,
    wanted: u64,
    segment_seconds: u32,
) -> SegmentPlan {
    if is_ready {
        return SegmentPlan::Serve;
    }

    let Some(run) = run else {
        return SegmentPlan::StartAt(wanted);
    };

    if wanted < run.from || wanted > run.reached() + restart_gap(segment_seconds) {
        return SegmentPlan::StartAt(wanted);
    }

    SegmentPlan::Wait
}

/// Whether the run that is writing has said this segment is whole.
///
/// ffmpeg names a segment in its own playlist only once it has closed it, so
/// being named there is the muxer's own word that nothing more is coming. That
/// is exactly as strong a guarantee as waiting for the next segment to appear,
/// and it arrives one whole segment sooner — up to 10.4 seconds on a copied
/// stream, which is a long time to hold a draining buffer at the live edge.
///
/// Only for a run that began at or before the segment. A run restarted further
/// on has a playlist that names none of what came before it, and its head says
/// nothing about a file some earlier run left behind.
#[must_use]
pub fn run_has_closed(run: Option<RunPosition>, wanted: u64) -> bool {
    run.is_some_and(|run| run.from <= wanted && run.head.is_some_and(|head| head >= wanted))
}

/// Whether a segment can be served.
///
/// Existing is not enough, and this is the piece Flux has never had: ffmpeg is
/// writing the segment it is on, so a file that exists may be half of one. It
/// is whole once the run that is writing it has named it, once the next one has
/// been started, or once the run that was writing it has finished the film.
///
/// Serving a partial segment is not an error anything reports. The player gets
/// fewer frames than the playlist promised and stalls at the boundary, which
/// is what a viewer sees as a stutter every ten seconds.
///
/// The next segment existing stays as the fallback, because a run's playlist is
/// deleted when the next run starts and the segments it left behind are still
/// perfectly good.
async fn is_segment_ready(
    directory: &Path,
    wanted: u64,
    is_complete: bool,
    run: Option<RunPosition>,
) -> bool {
    if !tokio::fs::try_exists(directory.join(crate::playlist::segment_name(index_of(wanted))))
        .await
        .unwrap_or(false)
    {
        return false;
    }

    if is_complete || run_has_closed(run, wanted) {
        return true;
    }

    tokio::fs::try_exists(directory.join(crate::playlist::segment_name(index_of(
        wanted.saturating_add(1),
    ))))
    .await
    .unwrap_or(false)
}

/// A segment number as the playlist counts them.
#[allow(
    clippy::cast_possible_truncation,
    reason = "a film with more segments than a usize can count does not exist"
)]
fn index_of(number: u64) -> usize {
    number as usize
}

/// How far the running transcode has got, from its own playlist.
///
/// ffmpeg names a segment there once it has closed it, so the last name in the
/// file is the last segment that is whole. Read from disk rather than tracked
/// in memory because the process writing it is the only thing that knows.
async fn head_of_run(directory: &Path) -> Option<u64> {
    let playlist = tokio::fs::read_to_string(directory.join(RUN_PLAYLIST_NAME))
        .await
        .ok()?;

    playlist.lines().filter_map(segment_number).max()
}

/// Where sessions live and how long they survive unused.
#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub ffmpeg: String,
    /// How the source's own keyframes are read.
    ///
    /// The segment boundaries of a copied stream are the source's, so a
    /// session cannot describe the film it is about to serve without asking.
    pub ffprobe: String,
    /// The render node VAAPI and QSV are opened on.
    ///
    /// A machine with two cards has a `renderD129` as well, and the one Flux
    /// should use is not something to guess at. Configurable for the same
    /// reason Jellyfin asks for it rather than detecting it: the admin knows
    /// which card is theirs to spend.
    pub device: String,
    pub cache_root: PathBuf,
    pub idle_timeout: Duration,
    pub max_concurrent: usize,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            ffmpeg: "ffmpeg".to_owned(),
            ffprobe: "ffprobe".to_owned(),
            device: crate::transcode_plan::DEFAULT_DEVICE.to_owned(),
            cache_root: std::env::temp_dir().join("flux-transcodes"),
            idle_timeout: Duration::from_secs(90),
            max_concurrent: 2,
        }
    }
}

/// The set of live sessions.
#[derive(Debug, Clone)]
pub struct SessionRegistry {
    config: SessionConfig,
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    /// Which plans are being started right now.
    ///
    /// Working out where a film can be cut takes a moment, and a session is
    /// only in the map once that is done — so two viewers pressing play
    /// together both found nothing, both started a transcode, and two ffmpegs
    /// wrote over each other's segments in one directory. A player opening a
    /// stream asks twice on its own, so this is the common case rather than
    /// the rare one.
    starting: Arc<Mutex<std::collections::HashSet<String>>>,
}

impl SessionRegistry {
    #[must_use]
    pub fn new(config: SessionConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            starting: Arc::new(Mutex::new(std::collections::HashSet::new())),
        }
    }

    #[must_use]
    pub fn config(&self) -> &SessionConfig {
        &self.config
    }

    /// Starts a session, or joins the one already serving this treatment.
    ///
    /// Addressed by the plan rather than by where playback began, so everybody
    /// watching the same film at the same quality shares one directory and one
    /// transcode however differently they joined it. Where a viewer joins
    /// decides where the run starts, not which session they are in. See
    /// ADR-0011.
    ///
    /// # Errors
    ///
    /// Returns [`SessionError`] when the directory cannot be made or the
    /// source cannot be read well enough to say where its segments fall.
    pub async fn start(
        &self,
        spec: SessionSpec,
        device: Option<&str>,
    ) -> Result<String, SessionError> {
        let id = spec.plan_id();
        let deadline = Instant::now() + STARTING_TIMEOUT;

        loop {
            if let Some(joined) = self.join(&id, device).await {
                return Ok(joined);
            }

            {
                let mut starting = self.starting.lock().await;

                if starting.insert(id.clone()) || Instant::now() >= deadline {
                    break;
                }
            }

            tokio::time::sleep(SEGMENT_POLL).await;
        }

        let outcome = self.begin(&id, spec, device).await;

        self.starting.lock().await.remove(&id);

        outcome
    }

    /// Joins the session for a plan, if there is one.
    ///
    /// Counts the joiner as a holder, so the transcode outlives whichever of
    /// them stops first.
    async fn join(&self, id: &str, device: Option<&str>) -> Option<String> {
        let mut sessions = self.sessions.lock().await;
        let existing = sessions.get_mut(id)?;

        existing.touch();
        existing.holders += 1;

        let directory = existing.directory.clone();

        drop(sessions);

        if let Some(device) = device {
            record_device(&directory, device).await;
        }

        Some(id.to_owned())
    }

    /// Makes the session for a plan nothing is serving yet.
    async fn begin(
        &self,
        id: &str,
        spec: SessionSpec,
        device: Option<&str>,
    ) -> Result<String, SessionError> {
        let id = id.to_owned();

        self.collect_idle().await;

        let directory = self.config.cache_root.join(&id);

        tokio::fs::create_dir_all(&directory)
            .await
            .map_err(SessionError::Directory)?;

        if let Some(device) = device {
            record_device(&directory, device).await;
        }

        let boundaries = ensure_boundaries(&self.config.ffprobe, &directory, &spec).await;

        if boundaries.is_empty() {
            return Err(SessionError::Boundaries(spec.input_path.clone()));
        }

        let spec = deliverable(&self.config, spec, boundaries.can_copy).await;

        let device_filters = match spec.hardware_accel.pipeline() {
            Some(pipeline) => {
                let capabilities = crate::capability::detect_capabilities(
                    &self.config.ffmpeg,
                    &self.config.device,
                )
                .await;

                DeviceFilters {
                    scaler: capabilities
                        .hardware_scalers
                        .iter()
                        .any(|found| found == pipeline.scaler),
                    overlay: capabilities
                        .hardware_overlays
                        .iter()
                        .any(|found| found == pipeline.overlay),
                    tone_map: pipeline.tone_map.is_some_and(|mapper| {
                        let name = crate::transcode_plan::filter_name(mapper);

                        capabilities
                            .hardware_tone_maps
                            .iter()
                            .any(|found| found == name)
                    }),
                }
            }
            None => DeviceFilters::default(),
        };

        let plan = TranscodePlan {
            spec: spec.clone(),
            output_directory: directory.to_string_lossy().into_owned(),
            device: self.config.device.clone(),
            device_filters,
            start_at: SegmentStart::default(),
            cut_seconds: boundaries.cut_seconds,
        };

        let mut session = Session {
            id: id.clone(),
            directory,
            spec,
            plan,
            cancel: None,
            running_from: None,
            last_touched: Instant::now(),
            reached: Arc::new(AtomicU64::new(0)),
            woken: Arc::new(Notify::new()),
            holders: 1,
            lengths: Arc::new(boundaries.lengths),
            last_wanted: 0,
        };

        if is_already_complete(&session.directory).await {
            mark_used(&session.directory).await;
        } else {
            let opening = segment_at(&session.lengths, f64::from(session.spec.start_seconds))
                .and_then(|index| u64::try_from(index).ok())
                .unwrap_or(0);

            self.begin_run(&mut session, opening).await;
        }

        let mut sessions = self.sessions.lock().await;

        sessions.insert(id.clone(), session);

        Ok(id)
    }

    /// Starts a run at a segment, stopping whatever was running before.
    ///
    /// A seek that lands outside what the transcode is about to produce is
    /// answered here: the run walking through the wrong part of the film is
    /// stopped and another is started where the viewer is. Nothing already on
    /// disk is thrown away, so a viewer who seeks back into it waits for
    /// nothing at all.
    ///
    /// `false` means there is no such session.
    pub async fn restart_at(&self, id: &str, wanted: u64) -> bool {
        let mut sessions = self.sessions.lock().await;

        let Some(session) = sessions.get_mut(id) else {
            return false;
        };

        if session.running_from == Some(wanted) {
            return true;
        }

        session.stop();

        self.begin_run(session, wanted).await;

        true
    }

    /// Starts a run at a segment, recording it as the live one.
    async fn begin_run(&self, session: &mut Session, wanted: u64) {
        begin_run_inner(self, session, wanted).await;
    }

    /// Records that a run has ended, however it ended.
    ///
    /// Only if it is still the run the session believes in: a restart has
    /// already replaced it, and the run being replaced must not clear the
    /// record of the one that replaced it.
    async fn run_ended(&self, id: &str, from: u64) {
        let mut sessions = self.sessions.lock().await;

        if let Some(session) = sessions.get_mut(id) {
            if session.running_from == Some(from) {
                session.running_from = None;
                session.cancel = None;
            }
        }
    }

    /// Where the running transcode is, and where every segment falls.
    ///
    /// One reading rather than four calls, because deciding what to do about a
    /// segment request needs all of it and the answers have to describe the
    /// same moment.
    pub async fn segment_view(&self, id: &str) -> Option<SegmentView> {
        let sessions = self.sessions.lock().await;
        let session = sessions.get(id)?;

        Some(SegmentView {
            directory: session.directory.clone(),
            segment_seconds: session.spec.segment_seconds,
            lengths: Arc::clone(&session.lengths),
            running_from: session.running_from,
        })
    }

    /// Reports the directory of a session and marks it as used.
    #[must_use]
    pub async fn touch(&self, id: &str) -> Option<PathBuf> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions.get_mut(id)?;

        session.touch();

        Some(session.directory.clone())
    }

    /// Records which segment a viewer has just been given.
    ///
    /// This is how a transcode knows where the viewer has got to. It serves
    /// the segments itself, so nobody has to be told — the number is in the
    /// name of the file that was asked for.
    ///
    /// The highest ever asked for rather than the latest, because a viewer
    /// skipping backwards inside what is already encoded is not a reason to
    /// start encoding again.
    pub async fn reached(&self, id: &str, name: &str) {
        let Some(number) = segment_number(name) else {
            return;
        };

        self.wants(id, number).await;
    }

    /// Records which segment a viewer is asking for.
    ///
    /// Asking counts, not only being served. The throttle pauses a transcode
    /// that is further ahead than anyone is watching, and it reads this — so a
    /// viewer waiting for a segment beyond a paused run would wait for a
    /// process that only a served segment could restart, and only that segment
    /// could serve. Measured: a run restarted at segment 397 produced to 435,
    /// paused, and a request for 439 waited the full timeout and was refused.
    async fn wants(&self, id: &str, number: u64) {
        let mut sessions = self.sessions.lock().await;

        if let Some(session) = sessions.get_mut(id) {
            session.reached.fetch_max(number, Ordering::Relaxed);
            session.last_wanted = number;
            session.woken.notify_one();
        }
    }

    /// Whether this request is the one the transcode is being steered by.
    ///
    /// The most recent asker steers. Anything earlier waits for what it can
    /// get and gives up if it cannot, rather than pulling the run back to
    /// itself and starting the fight again.
    async fn steers(&self, id: &str, wanted: u64) -> bool {
        let sessions = self.sessions.lock().await;

        sessions
            .get(id)
            .is_some_and(|session| session.last_wanted == wanted)
    }

    /// Records a player's heartbeat: alive, and playing or paused.
    ///
    /// `false` means no such session — the caller should stop sending
    /// heartbeats for an id the server no longer recognises.
    pub async fn heartbeat(&self, id: &str, is_playing: bool) -> bool {
        let mut sessions = self.sessions.lock().await;

        let Some(session) = sessions.get_mut(id) else {
            return false;
        };

        session.heartbeat(is_playing);

        true
    }

    /// Lets go of a session, stopping the transcode when the last viewer does.
    ///
    /// Everybody watching the same film shares one session, so stopping it
    /// unconditionally is one viewer closing a tab and taking the transcode
    /// away from everyone else — demonstrated against the running service,
    /// where the second viewer's manifest went missing the moment the first
    /// stopped. See ADR-0011.
    ///
    /// The segments stay on disk either way. What ends is the process writing
    /// more of them.
    pub async fn stop(&self, id: &str) -> bool {
        let mut sessions = self.sessions.lock().await;

        let Some(session) = sessions.get_mut(id) else {
            return false;
        };

        session.holders = session.holders.saturating_sub(1);

        if session.holders == 0 {
            if let Some(mut last) = sessions.remove(id) {
                last.stop();
            }
        }

        true
    }

    /// Waits until a segment can be served, producing it if nothing will.
    ///
    /// The whole of the delivery model is here: a segment already written is
    /// served at once, one the transcode is coming to is waited for, and one
    /// nothing is going to reach starts a run where the viewer is.
    ///
    /// `false` means the wait ran out, which is a transcode that has stopped
    /// making progress rather than a segment that does not exist.
    pub async fn await_segment(&self, id: &str, wanted: u64, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;

        self.wants(id, wanted).await;

        loop {
            let Some(view) = self.segment_view(id).await else {
                return false;
            };

            let is_complete = is_already_complete(&view.directory).await;
            let run = view.run().await;
            let is_ready = is_segment_ready(&view.directory, wanted, is_complete, run).await;

            match resolve_segment(is_ready, run, wanted, view.segment_seconds) {
                SegmentPlan::Serve => return true,
                SegmentPlan::StartAt(index) => {
                    if self.steers(id, wanted).await && !self.restart_at(id, index).await {
                        return false;
                    }
                }
                SegmentPlan::Wait => {}
            }

            if Instant::now() >= deadline {
                return false;
            }

            tokio::time::sleep(SEGMENT_POLL).await;
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

    /// The ids of every session that exists right now.
    ///
    /// A session id is also the name of its directory, so this is what a sweep
    /// needs to know which directories are being watched. Read from the
    /// registry rather than from the disk, because only the registry can tell
    /// a finished transcode somebody is playing from one nobody has opened in
    /// a week.
    pub async fn live_ids(&self) -> std::collections::HashSet<String> {
        self.sessions.lock().await.keys().cloned().collect()
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

/// What deciding about a segment request needs to know.
#[derive(Debug)]
pub struct SegmentView {
    directory: PathBuf,
    segment_seconds: u32,
    lengths: Arc<Vec<f64>>,
    running_from: Option<u64>,
}

impl SegmentView {
    /// How many segments the film has.
    #[must_use]
    pub fn segments(&self) -> usize {
        self.lengths.len()
    }

    /// Where the live run is, if one is running.
    async fn run(&self) -> Option<RunPosition> {
        let from = self.running_from?;

        Some(RunPosition {
            from,
            head: head_of_run(&self.directory).await,
        })
    }
}

/// Where to seek to for a run that is to begin at a segment.
///
/// The middle of it, not its edge. A seek lands on the last keyframe decoded
/// at or before the time asked for, and a keyframe is decoded before it is
/// shown, so asking for the boundary itself lands on the one before it and the
/// run writes every segment one place out. The middle cannot overshoot: the
/// next keyframe is the segment's far edge.
///
/// Nought for the first segment, which is where the film starts and needs no
/// seek at all.
#[must_use]
fn seek_into(lengths: &[f64], index: usize) -> f64 {
    if index == 0 {
        return 0.0;
    }

    let start: f64 = lengths.iter().take(index).sum();

    start + lengths.get(index).copied().unwrap_or(0.0) / 2.0
}

/// Starts a run at a segment and records that it is the live one.
///
/// The run's own playlist is removed first. It is how far the transcode has
/// got, and one left behind by the run being replaced would say the new one
/// had already reached somewhere it has not started.
///
/// The registry is told when the run ends, whether it finished the film or
/// died on its own. Without that a session goes on believing a transcode is
/// coming: every request for a segment the dead run never wrote waits the
/// full timeout and is then refused, which a viewer sees as the stream
/// stopping for good after a scrub. Measured in a scrubbing session — twenty
/// one runs, and segment 237 waited 30 seconds for a run that had already
/// exited.
#[allow(
    clippy::used_underscore_items,
    reason = "the free function is the body of the method beside it"
)]
async fn begin_run_inner(registry: &SessionRegistry, session: &mut Session, wanted: u64) {
    let start_at = SegmentStart {
        index: u32::try_from(wanted).unwrap_or(u32::MAX),
        seconds: seek_into(&session.lengths, index_of(wanted)),
    };

    let _ = tokio::fs::remove_file(session.directory.join(RUN_PLAYLIST_NAME)).await;

    let plan = TranscodePlan {
        start_at,
        ..session.plan.clone()
    };

    let (cancel_tx, cancel_rx) = oneshot::channel();
    let supervised = plan.clone();
    let config = registry.config.clone();
    let watched = Arc::clone(&session.reached);
    let woken = Arc::clone(&session.woken);
    let ending = registry.clone();
    let id = session.id.clone();

    session.reached.store(wanted, Ordering::Relaxed);

    tokio::spawn(async move {
        supervise(config, supervised, cancel_rx, watched, woken).await;

        ending.run_ended(&id, wanted).await;
    });

    session.plan = plan;
    session.cancel = Some(cancel_tx);
    session.running_from = Some(wanted);
}

/// Runs one ffmpeg attempt to completion, or until cancelled.
async fn run_attempt(
    ffmpeg: &str,
    plan: &TranscodePlan,
    cancel: &mut oneshot::Receiver<()>,
    reached: &Arc<AtomicU64>,
    woken: &Arc<Notify>,
) -> ExitClass {
    let Ok(child) = spawn_ffmpeg(ffmpeg, plan) else {
        return ExitClass::InputError;
    };

    let pid = child.id();
    let directory = PathBuf::from(&plan.output_directory);
    let segment_seconds = plan.spec.segment_seconds;
    let started_at = u64::from(plan.start_at.index);

    let waiting = child.wait_with_output();
    tokio::pin!(waiting);

    let mut ticker = tokio::time::interval(THROTTLE_INTERVAL);
    let mut paused = false;

    let outcome = loop {
        tokio::select! {
            biased;

            _ = &mut *cancel => break ExitClass::Cancelled,

            () = woken.notified() => {
                follow_the_viewer(
                    pid,
                    &directory,
                    started_at,
                    segment_seconds,
                    reached,
                    &mut paused,
                )
                .await;
            }

            _ = ticker.tick() => {
                follow_the_viewer(
                    pid,
                    &directory,
                    started_at,
                    segment_seconds,
                    reached,
                    &mut paused,
                )
                .await;
            }

            finished = &mut waiting => break match finished {
            Err(_) => ExitClass::InputError,
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let class = classify_exit(output.status.code(), &stderr);

                if !matches!(class, ExitClass::Completed | ExitClass::Cancelled) {
                    eprintln!(
                        "transcode failed ({class:?}{}) for {}:\n{}",
                        describe_signal(output.status),
                        plan.spec.input_path,
                        tail_of(&stderr, FFMPEG_LINES)
                    );
                }

                class
            }
        },
        }
    };

    release_if_paused(pid, paused);

    outcome
}

/// Pauses or resumes the run to match how far ahead of the viewer it has got.
///
/// Called both on the throttle's own tick and the moment a request tells the
/// session where a viewer is. The tick alone meant a viewer arriving at the
/// edge of a paused transcode waited up to `THROTTLE_INTERVAL` for it to
/// notice, which is long enough to empty a small buffer.
async fn follow_the_viewer(
    pid: Option<u32>,
    directory: &Path,
    started_at: u64,
    segment_seconds: u32,
    reached: &Arc<AtomicU64>,
    paused: &mut bool,
) {
    let Some(pid) = pid else {
        return;
    };

    let head = head_of_run(directory).await.unwrap_or(started_at);
    let wanted = is_too_far_ahead(head, reached.load(Ordering::Relaxed), segment_seconds);

    if wanted != *paused {
        set_paused(pid, wanted);
        *paused = wanted;
    }
}

/// Lets a paused transcode run again before it is taken away.
///
/// Not what makes cancellation work — a stopped process can still be killed.
/// It is here so that nothing afterwards can leave ffmpeg stopped for good,
/// holding its output directory and its place in the film with nobody left to
/// resume it.
fn release_if_paused(pid: Option<u32>, paused: bool) {
    if !paused {
        return;
    }

    if let Some(pid) = pid {
        set_paused(pid, false);
    }
}

/// Names the signal that killed a process, for the log.
///
/// Empty for an ordinary exit, so the caller can always interpolate it. The
/// number rather than a name: `libc` is not a dependency here, and an operator
/// reading "signal 6" can look it up, where a wrong name would mislead.
#[cfg(unix)]
fn describe_signal(status: std::process::ExitStatus) -> String {
    use std::os::unix::process::ExitStatusExt as _;

    match status.signal() {
        Some(signal) => format!(", killed by signal {signal}"),
        None => String::new(),
    }
}

#[cfg(not(unix))]
fn describe_signal(_status: std::process::ExitStatus) -> String {
    String::new()
}

/// Whether a failed attempt is worth trying again without hardware.
///
/// Any hardware encode that did not finish is retried in software, whatever
/// the error said. This used to require the error to match one of seven
/// phrases in ffmpeg's output, which meant a failure phrased any other way
/// read as a bad file and the retry never happened — an encoder rejecting a
/// source's caption SEI killed the stream outright, and the viewer was told
/// their browser could not play it.
///
/// A retry that turns out to be pointless costs one attempt. A retry that
/// should have happened costs the stream, so the doubt is spent on trying.
///
/// A cancelled attempt is nobody asking any more, so it stops. See ADR-0009.
#[must_use]
pub fn should_retry_in_software(outcome: ExitClass, uses_hardware: bool) -> bool {
    uses_hardware && !matches!(outcome, ExitClass::Completed | ExitClass::Cancelled)
}

/// How far ahead of the viewer a transcode is allowed to get.
///
/// Past this it is paused until they catch up. Sixty seconds is Jellyfin's
/// floor and is chosen for the same reason: far enough that a viewer skipping
/// about inside what is already encoded never waits, close enough that a
/// session abandoned mid-film has done a minute of work rather than an hour of
/// it.
const THROTTLE_AHEAD_SECONDS: u64 = 60;

/// How often the gap is measured.
///
/// Cheap — one small file and a signal — so this can be frequent enough that
/// resuming feels immediate when a viewer reaches the end of what has been
/// encoded.
const THROTTLE_INTERVAL: Duration = Duration::from_secs(2);

/// How long to wait for another viewer's start of the same plan.
///
/// Long enough to cover reading a large film's keyframes, which is the slow
/// part of starting and is paid once per plan. Past it the wait is treated as
/// a start that will never finish rather than one still working.
const STARTING_TIMEOUT: Duration = Duration::from_secs(60);

/// How often a segment that is not ready yet is looked at again.
///
/// Short enough that a viewer waiting on the transcode is not made to wait
/// noticeably longer than it takes, and long enough that a hundred of them
/// waiting is not a hundred directory reads a second.
const SEGMENT_POLL: Duration = Duration::from_millis(100);

/// The segment number out of a name ffmpeg wrote.
///
/// Names come from `-hls_segment_filename segment%05d.m4s`, so the digits are
/// the segment's position in the film. Anything else — the playlist, the
/// initialisation segment — is not a position and returns nothing.
#[must_use]
pub fn segment_number(name: &str) -> Option<u64> {
    let digits: String = name
        .strip_prefix("segment")?
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();

    digits.parse().ok()
}

/// Stops or restarts a transcode that is too far ahead of the viewer.
///
/// A paused process is not a stopped one: it holds its place, its open files
/// and its position in the film, and carries on the moment it is told to. That
/// is the whole point — the alternative to pausing is either doing work nobody
/// asked for or throwing away the work already done.
///
/// `SIGSTOP` rather than writing to ffmpeg's stdin, which is how Jellyfin does
/// it: Flux passes `-nostdin`, and a signal needs nothing of the process it is
/// aimed at.
fn set_paused(pid: u32, paused: bool) {
    use sysinfo::{Pid, ProcessesToUpdate, Signal, System};

    let mut system = System::new();
    let pid = Pid::from_u32(pid);

    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);

    if let Some(process) = system.process(pid) {
        process.kill_with(if paused {
            Signal::Stop
        } else {
            Signal::Continue
        });
    }
}

/// Whether a transcode should be paused, given where it and the viewer are.
///
/// Both are segment numbers in the film's own numbering and converted here, so
/// the decision is about seconds of film rather than a count of files whose
/// length depends on how the session was configured.
#[must_use]
pub fn is_too_far_ahead(head: u64, reached: u64, segment_seconds: u32) -> bool {
    let ahead = head.saturating_sub(reached) * u64::from(segment_seconds.max(1));

    ahead > THROTTLE_AHEAD_SECONDS
}

/// Supervises a transcode from start to finish.
///
/// A hardware encoder that fails is retried once in software. A busy or broken
/// GPU should mean a slower film, not a dead player. See ADR-0009.
async fn supervise(
    config: SessionConfig,
    plan: TranscodePlan,
    mut cancel: oneshot::Receiver<()>,
    reached: Arc<AtomicU64>,
    woken: Arc<Notify>,
) {
    let directory = PathBuf::from(&plan.output_directory);
    let mut attempt = plan;

    for _ in 0..2 {
        let outcome = run_attempt(&config.ffmpeg, &attempt, &mut cancel, &reached, &woken).await;

        if outcome == ExitClass::Completed {
            let _ = tokio::fs::write(directory.join(COMPLETE_MARKER), b"ok").await;

            return;
        }

        if !should_retry_in_software(outcome, attempt.spec.uses_hardware()) {
            return;
        }

        eprintln!(
            "transcode: hardware encode of {} failed ({outcome:?}), retrying in software",
            attempt.spec.input_path
        );

        attempt = TranscodePlan {
            spec: attempt.spec.without_hardware(),
            output_directory: attempt.output_directory,
            device: attempt.device,
            device_filters: DeviceFilters::default(),
            start_at: attempt.start_at,
            cut_seconds: attempt.cut_seconds,
        };
    }
}

fn spawn_ffmpeg(ffmpeg: &str, plan: &TranscodePlan) -> Result<tokio::process::Child, SessionError> {
    let arguments = plan.to_ffmpeg_args();

    eprintln!(
        "transcode: {} -> {}\n  ffmpeg {}",
        plan.spec.input_path,
        plan.output_directory,
        arguments.join(" ")
    );

    let child = Command::new(ffmpeg)
        .args(arguments)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(SessionError::Spawn)?;

    Ok(child)
}

/// Waits for a run to prove that it started.
///
/// The playlist Flux serves is written before any transcoding happens, so
/// waiting for that would prove nothing: it is there whether ffmpeg works or
/// not. ffmpeg's own playlist is the evidence, and a session that never
/// produces one is a session whose viewer should be told rather than left
/// polling a manifest whose segments will never arrive.
///
/// A directory that already holds the finished film has nothing to run, and is
/// ready by definition.
#[must_use]
pub async fn await_run(directory: &Path, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    loop {
        for name in [RUN_PLAYLIST_NAME, COMPLETE_MARKER] {
            if tokio::fs::try_exists(directory.join(name))
                .await
                .unwrap_or(false)
            {
                return true;
            }
        }

        if Instant::now() >= deadline {
            return false;
        }

        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_exit, resolve_segment, run_has_closed, should_retry_in_software, ExitClass,
        RunPosition, SegmentPlan, SessionConfig, SessionRegistry,
    };

    fn run(from: u64, head: Option<u64>) -> RunPosition {
        RunPosition { from, head }
    }

    /// The muxer has named it, so it is whole and need not be waited on.
    #[test]
    fn takes_the_muxers_word_that_a_segment_is_closed() {
        assert!(run_has_closed(Some(run(0, Some(9))), 9));
        assert!(run_has_closed(Some(run(0, Some(9))), 4));
    }

    /// The segment the run is writing right now is not named yet.
    #[test]
    fn does_not_take_the_segment_still_being_written() {
        assert!(!run_has_closed(Some(run(0, Some(9))), 10));
    }

    /// A run that has written nothing has said nothing.
    #[test]
    fn takes_no_word_from_a_run_that_has_written_nothing() {
        assert!(!run_has_closed(Some(run(300, None)), 300));
    }

    /// A run's playlist names what that run wrote, and nothing before it.
    ///
    /// A run restarted at 300 says nothing about segment 12, which some earlier
    /// run left on disk — its own playlist was deleted when this one started.
    #[test]
    fn takes_no_word_about_a_segment_an_earlier_run_left() {
        assert!(!run_has_closed(Some(run(300, Some(320))), 12));
    }

    /// Nothing is running, so nobody has said anything.
    #[test]
    fn takes_no_word_when_nothing_is_running() {
        assert!(!run_has_closed(None, 4));
    }

    /// A segment that is whole is served, whatever the transcode is doing.
    #[test]
    fn serves_a_segment_that_is_ready() {
        assert_eq!(
            resolve_segment(true, Some(run(300, Some(302))), 0, 4),
            SegmentPlan::Serve
        );
    }

    /// Nothing is running, so nothing is going to write it.
    #[test]
    fn starts_a_run_when_none_is_running() {
        assert_eq!(
            resolve_segment(false, None, 42, 4),
            SegmentPlan::StartAt(42)
        );
    }

    /// The transcode is about to reach it, and waiting beats starting again.
    #[test]
    fn waits_for_a_transcode_that_is_coming_to_it() {
        assert_eq!(
            resolve_segment(false, Some(run(0, Some(9))), 10, 4),
            SegmentPlan::Wait
        );
    }

    /// A run that has written nothing yet is still on its way to its own
    /// first segment. Restarting it there would restart it forever.
    #[test]
    fn waits_for_a_run_that_has_not_written_anything_yet() {
        assert_eq!(
            resolve_segment(false, Some(run(300, None)), 300, 4),
            SegmentPlan::Wait
        );
    }

    /// Seeking back to something never produced: the run ahead will never
    /// come back for it.
    #[test]
    fn starts_a_run_behind_the_one_that_is_running() {
        assert_eq!(
            resolve_segment(false, Some(run(300, Some(320))), 12, 4),
            SegmentPlan::StartAt(12)
        );
    }

    /// Seeking forty minutes on: waiting would mean transcoding everything in
    /// between first.
    #[test]
    fn starts_a_run_where_a_viewer_has_seeked_to() {
        assert_eq!(
            resolve_segment(false, Some(run(0, Some(3))), 300, 4),
            SegmentPlan::StartAt(300)
        );
    }

    /// The line between waiting and starting again is seconds of film, so a
    /// long segment reaches it in fewer of them.
    #[test]
    fn measures_the_gap_in_seconds_of_film() {
        assert_eq!(
            resolve_segment(false, Some(run(0, Some(0))), 6, 4),
            SegmentPlan::Wait
        );
        assert_eq!(
            resolve_segment(false, Some(run(0, Some(0))), 7, 4),
            SegmentPlan::StartAt(7)
        );
    }

    /// A run is aimed inside the segment it is to start at, not at its edge.
    ///
    /// Measured on the Bluray remux: seeking to 2394.1, where segment 596
    /// begins, started the run at 2383.673 — the keyframe before it, because
    /// that is the last one decoded by the time asked for. Seeking to 2394.6
    /// starts it at 2394.100.
    #[test]
    fn seeks_into_a_segment_rather_than_at_it() {
        assert!((super::seek_into(&[13.055, 10.427, 7.132], 1) - 18.2685).abs() < 1e-9);
    }

    /// The film's beginning is not somewhere to seek to.
    #[test]
    fn does_not_seek_a_run_that_starts_at_the_beginning() {
        assert!((super::seek_into(&[13.055, 10.427], 0)).abs() < f64::EPSILON);
    }

    /// The number in the name is the position in the film, and the head is
    /// read out of the playlist ffmpeg keeps as it goes.
    #[test]
    fn reads_the_head_of_a_run_out_of_its_playlist() {
        let playlist = concat!(
            "#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-MAP:URI=\"init.mp4\"\n",
            "#EXTINF:13.055000,\nsegment00300.m4s\n",
            "#EXTINF:10.427000,\nsegment00301.m4s\n"
        );

        let head = playlist.lines().filter_map(super::segment_number).max();

        assert_eq!(head, Some(301));
    }

    /// The number in the name is the viewer's place in the film.
    #[test]
    fn reads_the_segment_number_out_of_the_name() {
        assert_eq!(super::segment_number("segment00042.m4s"), Some(42));
        assert_eq!(super::segment_number("segment00000.m4s"), Some(0));
    }

    /// Everything else in the directory is not a position.
    #[test]
    fn ignores_names_that_are_not_segments() {
        assert_eq!(super::segment_number("index.m3u8"), None);
        assert_eq!(super::segment_number("init.mp4"), None);
        assert_eq!(super::segment_number(".complete"), None);
    }

    /// A minute ahead is the point, so a minute exactly is not too far.
    #[test]
    fn lets_a_transcode_stay_a_minute_ahead() {
        assert!(!super::is_too_far_ahead(15, 0, 4));
    }

    #[test]
    fn pauses_a_transcode_that_has_run_away() {
        assert!(super::is_too_far_ahead(900, 3, 4));
    }

    /// The gap is seconds of film, not a count of files.
    ///
    /// Ten segments ahead is forty seconds at four second segments and a
    /// hundred at ten, and only one of those is worth pausing for.
    #[test]
    fn measures_the_gap_in_seconds_rather_than_segments() {
        assert!(!super::is_too_far_ahead(10, 0, 4));
        assert!(super::is_too_far_ahead(10, 0, 10));
    }

    /// A viewer ahead of the encoder is not a reason to pause it.
    #[test]
    fn never_pauses_a_transcode_the_viewer_has_caught_up_with() {
        assert!(!super::is_too_far_ahead(3, 900, 4));
    }

    #[test]
    fn a_clean_exit_is_completion() {
        assert_eq!(classify_exit(Some(0), ""), ExitClass::Completed);
    }

    /// A signal death is a crash, and a crash is worth another go.
    ///
    /// This asserted `Cancelled` for as long as the transcoder existed, which
    /// meant an aborted ffmpeg took the session down with no retry and no log
    /// — the cancellation path never reaches `classify_exit` at all, so the
    /// branch only ever saw crashes. See FLUX-112.
    #[test]
    fn no_status_means_it_crashed_rather_than_that_it_was_cancelled() {
        assert_eq!(classify_exit(None, ""), ExitClass::Crashed);
    }

    #[test]
    fn a_crash_is_retried_in_software() {
        assert!(should_retry_in_software(ExitClass::Crashed, true));
    }

    /// Nobody is waiting for a cancelled session, so it stops.
    #[test]
    fn a_cancellation_is_not_retried() {
        assert!(!should_retry_in_software(ExitClass::Cancelled, true));
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

    #[test]
    fn retries_a_hardware_failure_in_software() {
        assert!(should_retry_in_software(ExitClass::HardwareFailure, true));
    }

    #[test]
    fn retries_a_failure_no_marker_recognised() {
        let outcome = classify_exit(Some(1), "Unexpected end of SEI NAL Unit parsing size.");

        assert_eq!(outcome, ExitClass::InputError);
        assert!(should_retry_in_software(outcome, true));
    }

    #[test]
    fn does_not_retry_what_already_ran_in_software() {
        assert!(!should_retry_in_software(ExitClass::InputError, false));
    }

    #[test]
    fn does_not_retry_a_cancelled_attempt() {
        assert!(!should_retry_in_software(ExitClass::Cancelled, true));
    }

    #[test]
    fn does_not_retry_something_that_worked() {
        assert!(!should_retry_in_software(ExitClass::Completed, true));
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

    #[tokio::test]
    async fn heartbeating_an_unknown_session_reports_nothing() {
        let registry = SessionRegistry::new(SessionConfig::default());

        assert!(!registry.heartbeat("does-not-exist", true).await);
    }

    #[test]
    fn keeps_a_session_alive_through_three_missed_heartbeats_worth_of_idle_time() {
        assert_eq!(SessionConfig::default().idle_timeout.as_secs(), 90);
    }
}
