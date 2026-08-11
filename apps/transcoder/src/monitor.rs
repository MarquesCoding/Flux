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

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tokio::sync::Mutex;

use crate::queue::now_ms;

/// How many log lines are kept.
///
/// A few hundred is what somebody scrolls through when something has just gone
/// wrong. Anything longer belongs in a file, not in memory.
const LOG_LINES: usize = 400;

/// How serious a line is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
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
    /// What the media service itself is using.
    pub service_cpu_percent: f32,
    pub service_memory_bytes: u64,
    /// Every ffmpeg the service has running, and what each costs.
    pub children: Vec<ProcessUse>,
    /// One minute load average, where the platform reports one.
    pub load_average: f64,
}

/// Everything a monitoring page reads.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub resources: ResourceUse,
    pub queue: crate::queue::QueueSnapshot,
    pub sessions: usize,
    pub logs: Vec<LogLine>,
}

/// The rolling record of what has happened.
///
/// Cloning shares one record, so every part of the service writes to the same
/// place without any of them owning it.
#[derive(Clone, Default)]
pub struct Journal {
    lines: Arc<Mutex<VecDeque<LogLine>>>,
}

impl Journal {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Writes a line, dropping the oldest when full.
    pub async fn write(&self, level: LogLevel, source: &str, message: &str) {
        let mut lines = self.lines.lock().await;

        lines.push_front(LogLine {
            at_ms: now_ms(),
            level,
            source: source.to_owned(),
            message: message.to_owned(),
        });

        lines.truncate(LOG_LINES);
    }

    /// The lines kept, newest first.
    pub async fn read(&self) -> Vec<LogLine> {
        self.lines.lock().await.iter().cloned().collect()
    }
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
    journal: Journal,
}

impl Monitor {
    #[must_use]
    pub fn new(journal: Journal) -> Self {
        Self {
            system: Arc::new(Mutex::new(System::new())),
            journal,
        }
    }

    #[must_use]
    pub fn journal(&self) -> &Journal {
        &self.journal
    }

    /// Measures the machine and the processes the service is responsible for.
    pub async fn measure(&self) -> ResourceUse {
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

        ResourceUse {
            at_ms: now_ms(),
            system_cpu_percent: system.global_cpu_usage(),
            system_memory_used_bytes: system.used_memory(),
            system_memory_total_bytes: system.total_memory(),
            cpu_count: system.cpus().len(),
            service_cpu_percent: service.map_or(0.0, sysinfo::Process::cpu_usage),
            service_memory_bytes: service.map_or(0, sysinfo::Process::memory),
            children,
            load_average: System::load_average().one,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Journal, LogLevel, Monitor};

    #[tokio::test]
    async fn keeps_the_newest_line_first() {
        let journal = Journal::new();

        journal.write(LogLevel::Info, "scan", "started").await;
        journal.write(LogLevel::Error, "scan", "stopped").await;

        let lines = journal.read().await;

        assert_eq!(lines[0].message, "stopped");
        assert_eq!(lines[0].level, LogLevel::Error);
        assert_eq!(lines[1].message, "started");
    }

    #[tokio::test]
    async fn measures_the_machine_it_is_running_on() {
        let monitor = Monitor::new(Journal::new());

        let first = monitor.measure().await;

        assert!(first.cpu_count > 0, "a machine has at least one core");
        assert!(first.system_memory_total_bytes > 0);
    }
}
