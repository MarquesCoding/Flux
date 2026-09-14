//! What the machine is actually doing.
//!
//! A self-hosted server is somebody's own computer, and the question they ask
//! when the fans spin up is "what is it doing and will it stop". Answering
//! that needs more than an up-or-down health check: it needs what is running,
//! what it costs, and what went wrong recently. All of it is measured here and
//! read through one endpoint, so a page watching the server makes one request
//! rather than five.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use std::sync::Mutex as StdMutex;
use std::sync::OnceLock;
use sysinfo::{DiskRefreshKind, Disks, Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tokio::sync::Mutex;

use crate::cache_usage::CacheUse;
use crate::graphics::GraphicsUse;
use crate::queue::now_ms;

/// How many log lines are kept.
///
/// A few hundred is what somebody scrolls through when something has just gone
/// wrong. Anything longer belongs in a file, not in memory.
const LOG_LINES: usize = 400;

/// How often the filesystems are asked what is left on them.
///
/// Free space moves in minutes and asking costs a system call per mounted
/// filesystem, so a reading a second would pay that every second to watch a
/// number that has not changed. Half a minute is fresh enough for a figure
/// somebody glances at.
const DISK_INTERVAL: Duration = Duration::from_secs(30);

/// How often the graphics hardware is asked what it is doing.
///
/// The same tick as the page, so the figure moves with everything beside it. A
/// slower poll made it look frozen: the panes around it changed every second
/// and this one sat still, then jumped.
///
/// Affordable because it is measured, not assumed — the reading costs about
/// seventeen milliseconds, so once a second is under two percent of one core,
/// and it happens on its own timer where no request is waiting on it.
const GRAPHICS_INTERVAL: Duration = Duration::from_secs(1);

/// How often the artefact cache is added up.
///
/// Far rarer than anything else here, because measuring it means walking every
/// artefact directory on the disk — thousands of them on a real library. It is
/// also the figure that moves slowest: a cache grows over days, and nobody
/// watching this section is waiting for the number to twitch.
const CACHE_INTERVAL: Duration = Duration::from_secs(5 * 60);

/// How serious a line is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    /// The word this level is written as on a terminal line.
    #[must_use]
    pub fn as_word(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }
}

/// One thing that happened.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub at_ms: u64,
    pub level: LogLevel,
    /// Which part of the service is speaking.
    pub source: String,
    pub message: String,
}

/// What one ffmpeg is costing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessUse {
    pub pid: u32,
    /// Percent of one core, so two hundred means two cores saturated.
    pub cpu_percent: f32,
    pub memory_bytes: u64,
}

/// What the whole deployment is using, and what it is allowed.
///
/// Read from the cgroup, which is the only thing here that can see both halves
/// of Valence: the API server is a sibling process this one cannot reach through
/// the process tree. Nothing off Linux, and nothing where the hierarchy cannot
/// be trusted to describe a container rather than a host.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentMemory {
    pub used_bytes: u64,
    /// The ceiling the deployment is held to, where one is set.
    pub limit_bytes: Option<u64>,
}

/// What one mounted filesystem has room for.
///
/// Every filesystem the machine has, rather than a guess at which one matters:
/// the service does not know where the libraries are, and whoever asks does.
/// Matching a library against its mount point is their side of it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUse {
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

/// What the machine and the service are using.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceUse {
    pub at_ms: u64,
    /// Percent of the whole machine, across every core.
    pub system_cpu_percent: f32,
    pub system_memory_used_bytes: u64,
    pub system_memory_total_bytes: u64,
    pub cpu_count: usize,
    /// What the media service process itself is using, on its own. Whoever
    /// reads this adds the children to it: neither figure is what Valence costs
    /// without the other, and during a conversion almost all of it is theirs.
    pub service_cpu_percent: f32,
    pub service_memory_bytes: u64,
    /// Every ffmpeg the service has running, and what each costs.
    pub children: Vec<ProcessUse>,
    /// What everything in the deployment is using, where the cgroup will say.
    pub deployment_memory: Option<DeploymentMemory>,
    /// One minute load average, where the platform reports one.
    pub load_average: f64,
    /// Every mounted filesystem, measured less often than the rest of this.
    pub disks: Vec<DiskUse>,
    /// What the graphics hardware is doing, where the machine will say.
    pub graphics: Option<GraphicsUse>,
}

/// Everything a monitoring page reads.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub resources: ResourceUse,
    pub queue: crate::queue::QueueSnapshot,
    pub sessions: usize,
    pub logs: Vec<LogLine>,
    /// What the artefact cache holds, once it has been counted.
    pub cache: Option<CacheUse>,
}

/// The rolling record of what has happened.
///
/// Cloning shares one record, so every part of the service writes to the same
/// place without any of them owning it.
///
/// Guarded by an ordinary mutex rather than an async one, so that anywhere in
/// the service can write a line without being async and without awaiting. A
/// log that can only be written from async code is a log most of the code
/// cannot write to, which is how this one came to be written only by a test.
#[derive(Clone, Default)]
pub struct Journal {
    lines: Arc<StdMutex<VecDeque<LogLine>>>,
}

impl Journal {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Writes a line, dropping the oldest when full.
    ///
    /// Never panics on a poisoned lock: a log that stops working because a log
    /// write panicked once is worse than a lost line.
    pub fn write(&self, level: LogLevel, source: &str, message: &str) {
        let Ok(mut lines) = self.lines.lock() else {
            return;
        };

        lines.push_front(LogLine {
            at_ms: now_ms(),
            level,
            source: source.to_owned(),
            message: message.to_owned(),
        });

        lines.truncate(LOG_LINES);
    }

    /// The lines kept, newest first.
    #[must_use]
    pub fn read(&self) -> Vec<LogLine> {
        self.lines
            .lock()
            .map(|lines| lines.iter().cloned().collect())
            .unwrap_or_default()
    }
}

/// The journal this process writes to.
///
/// Held for the process rather than passed around because the places worth
/// logging from — a session failing, a preview giving up, a boundary scan
/// finding nothing — are nowhere near the router that owns the monitor, and
/// threading a handle to all of them is what stopped anybody doing it.
static JOURNAL: OnceLock<Journal> = OnceLock::new();

/// Names the journal the rest of the service writes to.
///
/// Called once at startup. Calling it again leaves the first one in place.
pub fn install_journal(journal: Journal) {
    let _ = JOURNAL.set(journal);
}

/// Writes a line to the journal and to stderr.
///
/// Both, always. Stderr is what `docker logs` shows and the only thing there is
/// before the monitor exists or after it has stopped answering; the journal is
/// what the admin area can actually reach.
pub fn record(level: LogLevel, source: &str, message: &str) {
    if let Some(journal) = JOURNAL.get() {
        journal.write(level, source, message);
    }

    eprintln!("{} {source}: {message}", level.as_word());
}

/// Reads what the machine is using.
///
/// Holds its own [`System`] between calls because CPU use is a difference
/// between two readings: a fresh one every time would report nothing, or
/// report the average since boot, which is not what anybody means by "what is
/// it doing now".
#[derive(Clone)]
pub struct Monitor {
    system: Arc<Mutex<System>>,
    disks: Arc<Mutex<DiskReadings>>,
    graphics: Arc<Mutex<Option<GraphicsUse>>>,
    cache: Arc<Mutex<Option<CacheUse>>>,
    journal: Journal,
}

/// The last answer the filesystems gave, and when they gave it.
///
/// Kept so that a page reading once a second is not a page running `statfs`
/// once a second: the reading is handed out again until it is old enough to be
/// worth taking another.
struct DiskReadings {
    disks: Disks,
    taken: Vec<DiskUse>,
    at: Option<Instant>,
}

impl DiskReadings {
    fn new() -> Self {
        Self {
            disks: Disks::new(),
            taken: Vec::new(),
            at: None,
        }
    }

    /// The filesystems, measured again only once the last reading is stale.
    fn read(&mut self) -> Vec<DiskUse> {
        let stale = self.at.is_none_or(|at| at.elapsed() >= DISK_INTERVAL);

        if stale {
            self.disks
                .refresh_specifics(true, DiskRefreshKind::nothing().with_storage());

            self.taken = self
                .disks
                .list()
                .iter()
                .filter(|disk| disk.total_space() > 0)
                .map(|disk| DiskUse {
                    mount_point: disk.mount_point().to_string_lossy().into_owned(),
                    total_bytes: disk.total_space(),
                    available_bytes: disk.available_space(),
                })
                .collect();

            self.at = Some(Instant::now());
        }

        self.taken.clone()
    }
}

impl Monitor {
    #[must_use]
    pub fn new(journal: Journal) -> Self {
        Self {
            system: Arc::new(Mutex::new(System::new())),
            disks: Arc::new(Mutex::new(DiskReadings::new())),
            graphics: Arc::new(Mutex::new(None)),
            cache: Arc::new(Mutex::new(None)),
            journal,
        }
    }

    #[must_use]
    pub fn journal(&self) -> &Journal {
        &self.journal
    }

    /// Starts asking the graphics hardware what it is doing.
    ///
    /// Deliberately not part of building a monitor. Reading a card means
    /// starting a vendor tool, and that must never be able to slow down or
    /// fail anything that is waiting: this writes to a cell on its own timer,
    /// and [`Monitor::measure`] only ever hands out what it finds there. A
    /// monitor nobody has started this on reports no card, which is also what
    /// a machine with nothing to say reports.
    pub fn watch_graphics(&self) {
        let cell = Arc::clone(&self.graphics);

        tokio::spawn(async move {
            let mut reader = crate::graphics::Reader::new();

            loop {
                let reading = reader.read().await;

                *cell.lock().await = reading;

                tokio::time::sleep(GRAPHICS_INTERVAL).await;
            }
        });
    }

    /// Starts adding up what the artefact cache is holding.
    ///
    /// The same reasoning as the graphics poller and more so: walking every
    /// artefact directory is real I/O against a disk that is also serving
    /// video, and it must never be something a page can set off by loading.
    /// This measures on its own timer and the report hands out what it finds.
    pub fn watch_cache(&self, root: std::path::PathBuf) {
        let cell = Arc::clone(&self.cache);

        tokio::spawn(async move {
            loop {
                let reading = crate::cache_usage::read(&root).await;

                *cell.lock().await = Some(reading);

                tokio::time::sleep(CACHE_INTERVAL).await;
            }
        });
    }

    /// Counts the cache now, rather than waiting for the timer.
    ///
    /// The one place a walk of the artefact directories may happen on a
    /// request, because here an operator has asked for it and is waiting for
    /// the answer. Everything that draws itself still reads the remembered
    /// figure.
    pub async fn count_cache(&self, root: &std::path::Path) -> CacheUse {
        let reading = crate::cache_usage::read(root).await;

        *self.cache.lock().await = Some(reading.clone());

        reading
    }

    /// What the cache was last found to be holding.
    ///
    /// Nothing until the first walk finishes, so a page that has just started
    /// says it is still counting rather than claiming an empty cache.
    pub async fn cache(&self) -> Option<CacheUse> {
        self.cache.lock().await.clone()
    }

    /// Measures the machine and the processes the service is responsible for.
    pub async fn measure(&self) -> ResourceUse {
        let disks = self.disks.lock().await.read();
        let graphics = self.graphics.lock().await.clone();
        let mut system = self.system.lock().await;

        system.refresh_cpu_usage();
        system.refresh_memory();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        let own = Pid::from_u32(std::process::id());

        let children: Vec<ProcessUse> = system
            .processes()
            .values()
            .filter(|process| process.parent() == Some(own))
            .map(|process| ProcessUse {
                pid: process.pid().as_u32(),
                cpu_percent: process.cpu_usage(),
                memory_bytes: process.memory(),
            })
            .collect();

        let service = system.process(own);

        let deployment_memory = crate::cgroup::memory()
            .await
            .map(|reading| DeploymentMemory {
                used_bytes: reading.used_bytes,
                limit_bytes: reading
                    .limit_bytes
                    .filter(|limit| *limit < system.total_memory()),
            });

        ResourceUse {
            at_ms: now_ms(),
            system_cpu_percent: system.global_cpu_usage(),
            system_memory_used_bytes: system.used_memory(),
            system_memory_total_bytes: system.total_memory(),
            cpu_count: system.cpus().len(),
            service_cpu_percent: service.map_or(0.0, sysinfo::Process::cpu_usage),
            service_memory_bytes: service.map_or(0, sysinfo::Process::memory),
            children,
            deployment_memory,
            load_average: System::load_average().one,
            disks,
            graphics,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{install_journal, record, Journal, LogLevel, Monitor, LOG_LINES};

    #[tokio::test]
    async fn keeps_the_newest_line_first() {
        let journal = Journal::new();

        journal.write(LogLevel::Info, "scan", "started");
        journal.write(LogLevel::Error, "scan", "stopped");

        let lines = journal.read();

        assert_eq!(lines[0].message, "stopped");
        assert_eq!(lines[0].level, LogLevel::Error);
        assert_eq!(lines[1].message, "started");
    }

    #[test]
    fn drops_the_oldest_once_it_is_full() {
        let journal = Journal::new();

        for index in 0..LOG_LINES + 10 {
            journal.write(LogLevel::Info, "scan", &format!("line {index}"));
        }

        assert_eq!(journal.read().len(), LOG_LINES);
    }

    #[test]
    fn says_nothing_when_read_before_anything_happened() {
        assert!(Journal::new().read().is_empty());
    }

    #[test]
    fn writes_what_the_service_records_into_the_journal_it_was_given() {
        let journal = Journal::new();

        install_journal(journal.clone());
        record(LogLevel::Warn, "transcode", "hardware encode failed");

        let found = journal
            .read()
            .into_iter()
            .find(|line| line.message == "hardware encode failed");

        assert!(
            found.is_some(),
            "a recorded line should reach the journal the admin area reads"
        );
    }

    #[tokio::test]
    async fn measures_the_machine_it_is_running_on() {
        let monitor = Monitor::new(Journal::new());

        let first = monitor.measure().await;

        assert!(first.cpu_count > 0, "a machine has at least one core");
        assert!(first.system_memory_total_bytes > 0);
    }

    #[tokio::test]
    async fn never_reports_a_ceiling_larger_than_the_machine_it_runs_on() {
        let monitor = Monitor::new(Journal::new());

        let reading = monitor.measure().await;

        if let Some(deployment) = reading.deployment_memory {
            assert!(
                deployment
                    .limit_bytes
                    .is_none_or(|limit| limit < reading.system_memory_total_bytes),
                "a ceiling at or above host memory is no ceiling, and reporting it as one would \
                 measure pressure against a limit nothing can reach"
            );
        }
    }

    #[tokio::test]
    async fn reports_only_filesystems_with_room_to_speak_of() {
        let monitor = Monitor::new(Journal::new());

        let reading = monitor.measure().await;

        assert!(
            reading
                .disks
                .iter()
                .all(|disk| disk.total_bytes > 0 && !disk.mount_point.is_empty()),
            "a filesystem with no size is a device, not somewhere media lives"
        );
    }

    #[tokio::test]
    async fn hands_out_the_same_disk_reading_rather_than_taking_another() {
        let monitor = Monitor::new(Journal::new());

        let first = monitor.measure().await;
        let second = monitor.measure().await;

        assert_eq!(
            first
                .disks
                .iter()
                .map(|disk| disk.mount_point.clone())
                .collect::<Vec<_>>(),
            second
                .disks
                .iter()
                .map(|disk| disk.mount_point.clone())
                .collect::<Vec<_>>()
        );
    }
}
