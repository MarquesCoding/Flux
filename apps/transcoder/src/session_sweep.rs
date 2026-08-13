//! Reclaiming transcode working directories nothing is watching any more.
//!
//! A session directory is scratch space for one playback, but it is also a
//! cache: it is addressed by hashing the request that made it, and a second
//! request for the same thing finds it finished and plays it without encoding
//! anything. That reuse is worth having — a viewer resuming in the evening
//! does not pay for the transcode twice.
//!
//! What it never is, is something to keep on purpose. A rendition somebody
//! deliberately wants belongs in a rendition store as a plain file that
//! playback can negotiate against, not as a directory of segments named after
//! one device's request. So everything here is disposable, and the only
//! question is when.
//!
//! Two rules, because either alone fails. Age alone lets a busy weekend fill a
//! disk before anything is old enough to go. A size cap alone throws away a
//! directory somebody is about to resume while the disk has room to spare.
//!
//! Nothing is removed on the strength of a list assembled elsewhere. What is
//! live comes from the registry in this process, and what is finished comes
//! from the marker the encode itself wrote.

use std::collections::HashSet;
use std::path::Path;
use std::time::{Duration, SystemTime};

use serde::Serialize;

/// How long a finished transcode stays worth keeping for its next viewer.
///
/// The case reuse serves is somebody resuming this evening, or a second person
/// in the house watching the same thing on the same kind of device. That value
/// decays fast: a day covers it, and a week is holding gigabytes against a
/// coincidence.
pub const MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

/// How much disk finished transcodes may hold between them.
///
/// Deliberately a figure an operator would not notice on a media server and
/// would notice on a laptop. The cost of it being too small is a transcode
/// done twice; the cost of there being no cap at all was sixty-five gigabytes.
pub const MAX_BYTES: u64 = 20 * 1024 * 1024 * 1024;

/// The directories under the cache root that are not sessions.
///
/// Previews and thumbnail sheets live here too and are swept on their own
/// terms, against a keep set only the API server can compute. Removing one of
/// those from here — where that keep set is not known — would delete artefacts
/// that are still addressed.
const NOT_SESSIONS: [&str; 2] = ["previews", "trickplay"];

/// What a cache is allowed to hold, and for how long.
///
/// Separated from the sweep so the same policy can govern any content
/// addressed cache the service keeps, rather than each growing its own rule.
#[derive(Debug, Clone, Copy)]
pub struct Budget {
    pub max_age: Duration,
    pub max_bytes: u64,
    /// How new is too new to judge, for a directory with no completion marker.
    pub grace: Duration,
}

impl Default for Budget {
    fn default() -> Self {
        Self {
            max_age: MAX_AGE,
            max_bytes: MAX_BYTES,
            grace: crate::cache_sweep::GRACE,
        }
    }
}

/// What an eviction did.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvictReport {
    pub removed: usize,
    pub freed_bytes: u64,
    /// Left alone because somebody is watching them.
    pub playing: usize,
    /// Left alone because they are unfinished and too new to call abandoned.
    pub too_new: usize,
    /// Left alone because they are still worth keeping.
    pub kept: usize,
}

/// One directory, and what is known about it.
struct Candidate {
    path: std::path::PathBuf,
    used_at: SystemTime,
    bytes: u64,
}

/// When a directory was last useful.
///
/// The completion marker is rewritten every time a finished transcode is
/// played again, so its timestamp is when somebody last wanted this — not when
/// it was made. Without that, an item replayed nightly ages out while one
/// watched once survives for being newer.
async fn used_at(directory: &Path, complete: &Path) -> SystemTime {
    let marker = tokio::fs::metadata(complete)
        .await
        .ok()
        .and_then(|found| found.modified().ok());

    match marker {
        Some(at) => at,
        None => tokio::fs::metadata(directory)
            .await
            .ok()
            .and_then(|found| found.modified().ok())
            .unwrap_or_else(SystemTime::now),
    }
}

/// Removes a directory, answering what it freed.
async fn remove(path: &Path, bytes: u64, report: &mut EvictReport) {
    if tokio::fs::remove_dir_all(path).await.is_ok() {
        report.removed += 1;
        report.freed_bytes += bytes;
    }
}

/// Reclaims what the transcode cache is holding and nobody is using.
///
/// `live` is the set of session ids the registry currently has, which are the
/// directory names of everything being watched right now. Anything in it is
/// untouchable whatever its age: removing a directory out from under a running
/// stream costs somebody their evening to save disk.
///
/// What cannot be removed still counts against the budget. A stream playing
/// now and a half-written directory too new to judge are both occupying the
/// disk, and a cap that ignored them would be a cap on the tidy half of the
/// cache rather than on what the cache costs. So they hold their space and the
/// spent directories give way around them.
pub async fn evict<S: std::hash::BuildHasher + Sync>(
    root: &Path,
    live: &HashSet<String, S>,
    budget: &Budget,
) -> EvictReport {
    let mut report = EvictReport::default();

    let Ok(mut entries) = tokio::fs::read_dir(root).await else {
        return report;
    };

    let now = SystemTime::now();
    let mut survivors: Vec<Candidate> = Vec::new();
    let mut untouchable: u64 = 0;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();

        if NOT_SESSIONS.contains(&name.as_str()) {
            continue;
        }

        if !entry.metadata().await.is_ok_and(|found| found.is_dir()) {
            continue;
        }

        let path = entry.path();

        if live.contains(&name) {
            report.playing += 1;
            untouchable += crate::cache_usage::size_of(&path).await;
            continue;
        }

        let complete = path.join(crate::session::COMPLETE_MARKER);
        let finished = tokio::fs::try_exists(&complete).await.unwrap_or(false);
        let at = used_at(&path, &complete).await;
        let age = now.duration_since(at).unwrap_or_default();
        let bytes = crate::cache_usage::size_of(&path).await;

        if !finished {
            if age < budget.grace {
                report.too_new += 1;
                untouchable += bytes;
            } else {
                remove(&path, bytes, &mut report).await;
            }

            continue;
        }

        if age > budget.max_age {
            remove(&path, bytes, &mut report).await;

            continue;
        }

        survivors.push(Candidate {
            path,
            used_at: at,
            bytes,
        });
    }

    survivors.sort_by_key(|candidate| candidate.used_at);

    let mut held: u64 = untouchable
        + survivors
            .iter()
            .map(|candidate| candidate.bytes)
            .sum::<u64>();
    let mut kept = survivors.len();

    for candidate in &survivors {
        if held <= budget.max_bytes {
            break;
        }

        let before = report.removed;

        remove(&candidate.path, candidate.bytes, &mut report).await;

        if report.removed > before {
            held -= candidate.bytes;
            kept -= 1;
        }
    }

    report.kept = kept;

    report
}

#[cfg(test)]
mod tests {
    use super::{evict, Budget, EvictReport};
    use std::collections::HashSet;
    use std::fs::{File, FileTimes};
    use std::path::{Path, PathBuf};
    use std::time::{Duration, SystemTime};

    const HOUR: Duration = Duration::from_secs(60 * 60);

    /// What the completion marker itself costs, so sizes here are exact.
    const MARKER: u64 = 2;

    fn root(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("flux-evict-{name}"));

        std::fs::remove_dir_all(&path).ok();
        std::fs::create_dir_all(&path).expect("the root can be made");

        path
    }

    /// A session directory holding `bytes`, finished or not, last used `ago`.
    fn session(root: &Path, name: &str, bytes: usize, finished: bool, ago: Duration) -> PathBuf {
        let path = root.join(name);

        std::fs::create_dir_all(&path).expect("the directory can be made");
        std::fs::write(path.join("index.m3u8"), vec![0_u8; bytes]).expect("the file is written");

        if finished {
            let marker = path.join(".complete");

            std::fs::write(&marker, b"ok").expect("the marker is written");

            let when = SystemTime::now() - ago;
            let file = File::options()
                .write(true)
                .open(&marker)
                .expect("the marker can be opened");

            file.set_times(FileTimes::new().set_modified(when))
                .expect("the marker can be aged");
        }

        path
    }

    fn budget(max_age: Duration, max_bytes: u64) -> Budget {
        Budget {
            max_age,
            max_bytes,
            grace: HOUR,
        }
    }

    async fn swept(root: &Path, live: &[&str], budget: &Budget) -> EvictReport {
        let live: HashSet<String> = live.iter().map(|id| (*id).to_owned()).collect();

        evict(root, &live, budget).await
    }

    #[tokio::test]
    async fn removes_a_finished_transcode_nobody_has_wanted_in_days() {
        let root = root("old");
        let path = session(&root, "ses_old", 100, true, 48 * HOUR);

        let report = swept(&root, &[], &budget(24 * HOUR, u64::MAX)).await;

        assert_eq!(report.removed, 1);
        assert_eq!(report.freed_bytes, 100 + MARKER);
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn keeps_one_somebody_may_still_come_back_to() {
        let root = root("recent");
        let path = session(&root, "ses_new", 100, true, Duration::from_secs(60));

        let report = swept(&root, &[], &budget(24 * HOUR, u64::MAX)).await;

        assert_eq!(report.removed, 0);
        assert_eq!(report.kept, 1);
        assert!(path.exists());
    }

    #[tokio::test]
    async fn never_removes_one_somebody_is_watching() {
        let root = root("live");
        let path = session(&root, "ses_live", 100, true, 500 * HOUR);

        let report = swept(&root, &["ses_live"], &budget(HOUR, 0)).await;

        assert_eq!(report.playing, 1);
        assert_eq!(report.removed, 0);
        assert!(
            path.exists(),
            "a stream being watched must survive both rules"
        );
    }

    #[tokio::test]
    async fn leaves_a_transcode_that_is_still_being_written() {
        let root = root("writing");
        let path = session(&root, "ses_writing", 100, false, Duration::ZERO);

        let report = swept(&root, &[], &budget(Duration::ZERO, 0)).await;

        assert_eq!(report.too_new, 1);
        assert_eq!(report.removed, 0);
        assert!(path.exists());
    }

    #[tokio::test]
    async fn removes_one_abandoned_halfway_through() {
        let root = root("abandoned");
        let path = root.join("ses_half");

        std::fs::create_dir_all(&path).expect("the directory can be made");
        std::fs::write(path.join("index.m3u8"), vec![0_u8; 10]).expect("written");

        let past_grace = Budget {
            max_age: 24 * HOUR,
            max_bytes: u64::MAX,
            grace: Duration::ZERO,
        };

        let report = swept(&root, &[], &past_grace).await;

        assert_eq!(report.removed, 1, "no marker and past grace is abandoned");
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn never_touches_the_preview_or_thumbnail_caches() {
        let root = root("kinds");

        std::fs::create_dir_all(root.join("previews/abc")).expect("made");
        std::fs::create_dir_all(root.join("trickplay/def")).expect("made");

        let report = swept(&root, &[], &budget(Duration::ZERO, 0)).await;

        assert_eq!(report.removed, 0);
        assert!(root.join("previews/abc").exists());
        assert!(root.join("trickplay/def").exists());
    }

    #[tokio::test]
    async fn evicts_the_oldest_first_when_over_budget() {
        let root = root("budget");
        let oldest = session(&root, "ses_a", 100, true, 5 * HOUR);
        let newest = session(&root, "ses_b", 100, true, HOUR);

        let report = swept(&root, &[], &budget(24 * HOUR, 100 + MARKER)).await;

        assert_eq!(report.removed, 1);
        assert!(!oldest.exists(), "the least recently wanted goes first");
        assert!(newest.exists());
    }

    #[tokio::test]
    async fn stops_evicting_once_it_is_under_budget() {
        let root = root("enough");

        session(&root, "ses_a", 100, true, 5 * HOUR);
        session(&root, "ses_b", 100, true, 4 * HOUR);
        session(&root, "ses_c", 100, true, 3 * HOUR);

        let report = swept(&root, &[], &budget(24 * HOUR, 2 * (100 + MARKER))).await;

        assert_eq!(report.removed, 1, "one is enough to get under the cap");
        assert_eq!(report.kept, 2);
    }

    #[tokio::test]
    async fn says_nothing_happened_on_a_cache_that_is_not_there() {
        let report = evict(
            &std::env::temp_dir().join("flux-evict-absent"),
            &HashSet::<String>::new(),
            &Budget::default(),
        )
        .await;

        assert_eq!(report, EvictReport::default());
    }

    #[tokio::test]
    async fn counts_a_stream_being_watched_against_the_budget() {
        let root = root("live-budget");
        let watched = session(&root, "ses_live", 300, true, HOUR);
        let spent = session(&root, "ses_spent", 100, true, 2 * HOUR);

        let report = swept(&root, &["ses_live"], &budget(24 * HOUR, 200)).await;

        assert_eq!(report.playing, 1);
        assert_eq!(
            report.removed, 1,
            "the spent one gives way to the watched one"
        );
        assert!(watched.exists());
        assert!(!spent.exists());
    }

    #[tokio::test]
    async fn counts_a_half_written_directory_against_the_budget() {
        let root = root("writing-budget");
        let writing = session(&root, "ses_writing", 300, false, Duration::ZERO);
        let spent = session(&root, "ses_spent", 100, true, 2 * HOUR);

        let report = swept(&root, &[], &budget(24 * HOUR, 200)).await;

        assert_eq!(report.too_new, 1);
        assert_eq!(report.removed, 1, "disk in flight is still disk");
        assert!(writing.exists());
        assert!(!spent.exists());
    }

    #[tokio::test]
    async fn holds_a_whole_cache_that_fits() {
        let root = root("fits");

        session(&root, "ses_a", 100, true, HOUR);
        session(&root, "ses_b", 100, true, HOUR);

        let report = swept(&root, &[], &budget(24 * HOUR, 1000)).await;

        assert_eq!(report.removed, 0);
        assert_eq!(report.kept, 2);
    }
}
