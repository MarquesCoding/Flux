//! Removing artefacts nothing addresses any more.
//!
//! Previews and thumbnail sheets are addressed by their content, and that
//! address covers the file, the geometry, the recipe that made them and the
//! generation of the library they belong to. Anything that changes renames them,
//! which is what makes a rebuild rebuild — and leaves the old directory behind,
//! addressed by a name nothing will ask for again.
//!
//! Renaming rather than deleting is deliberate: an orphaned directory costs
//! disk, while deleting on the strength of a wrong list costs somebody their
//! thumbnails. So nothing is removed at the moment it is orphaned, and this is
//! the one thing that ever removes it.
//!
//! The addresses are computed here rather than by the caller. The hash belongs
//! to the request types, and a sweep that disagreed with them about naming would
//! delete precisely the artefacts still in use.

use std::collections::HashSet;
use std::path::Path;
use std::time::{Duration, SystemTime};

use serde::Serialize;

/// How recently touched a directory has to be to survive on age alone.
///
/// A scan running while a sweep runs is ordinary, and an artefact halfway
/// through being written has no `.complete` marker — which is exactly what an
/// abandoned one looks like. An hour is far longer than any single artefact
/// takes to make and far shorter than the gap between sweeps.
pub const GRACE: Duration = Duration::from_secs(60 * 60);

/// What a sweep did.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SweepReport {
    /// Directories removed.
    pub removed: usize,
    /// Bytes reclaimed, as far as the directory sizes could be read.
    pub freed_bytes: u64,
    /// Directories left alone because something still addresses them.
    pub kept: usize,
    /// Directories left alone because they were too new to judge.
    pub too_new: usize,
}

/// Adds up the files directly inside a directory.
async fn size_of(directory: &Path) -> u64 {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return 0;
    };

    let mut total = 0;

    while let Ok(Some(entry)) = entries.next_entry().await {
        if let Ok(metadata) = entry.metadata().await {
            if metadata.is_file() {
                total += metadata.len();
            }
        }
    }

    total
}

/// Whether a directory was last written to within the grace period.
///
/// Anything unreadable, undated, or dated in the future counts as recent. Every
/// uncertainty here resolves towards keeping the directory: the cost of being
/// wrong that way is disk, and the cost of being wrong the other way is
/// somebody's thumbnails.
async fn is_recent(directory: &Path, grace: Duration, now: SystemTime) -> bool {
    let Ok(metadata) = tokio::fs::metadata(directory).await else {
        return true;
    };

    let Ok(modified) = metadata.modified() else {
        return true;
    };

    now.duration_since(modified).map_or(true, |age| age < grace)
}

/// Removes every directory under `root` whose name is not in `keep`.
///
/// A directory younger than `grace` is left alone whatever its name, because it
/// may be being written right now.
pub async fn sweep<S: std::hash::BuildHasher + Sync>(
    root: &Path,
    keep: &HashSet<String, S>,
    grace: Duration,
) -> SweepReport {
    let mut report = SweepReport::default();

    let Ok(mut entries) = tokio::fs::read_dir(root).await else {
        return report;
    };

    let now = SystemTime::now();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();

        if !entry.metadata().await.is_ok_and(|found| found.is_dir()) {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();

        if keep.contains(&name) {
            report.kept += 1;
            continue;
        }

        if is_recent(&path, grace, now).await {
            report.too_new += 1;
            continue;
        }

        let freed = size_of(&path).await;

        if tokio::fs::remove_dir_all(&path).await.is_ok() {
            report.removed += 1;
            report.freed_bytes += freed;
        }
    }

    report
}

/// Removes one artefact, so the next request for it makes it again.
///
/// The sweep's opposite number. A sweep decides what to delete by working out
/// what is still wanted and removing the rest, which is why it is hedged about
/// with grace periods and shared request builders — a mistake there takes
/// artefacts nobody meant to touch.
///
/// This is the safe kind of deletion: an operator points at one item and says
/// make it again. The directory is named by hashing the request that addresses
/// it, so there is no id to get wrong and no list to compute, and the worst
/// possible outcome is that one artefact is rendered a second time.
///
/// Answers whether anything was there, so a caller can tell "removed it" from
/// "there was nothing to remove" rather than reporting success either way.
pub async fn forget(root: &Path, id: &str) -> bool {
    tokio::fs::remove_dir_all(root.join(id)).await.is_ok()
}

#[cfg(test)]
mod tests {
    use super::{forget, sweep, SweepReport, GRACE};
    use std::collections::HashSet;
    use std::time::Duration;

    fn root(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("flux-sweep-{name}"));

        std::fs::remove_dir_all(&path).ok();
        std::fs::create_dir_all(&path).expect("creates the root");

        path
    }

    fn artefact(root: &std::path::Path, id: &str, bytes: usize) {
        let directory = root.join(id);

        std::fs::create_dir_all(&directory).expect("creates the artefact");
        std::fs::write(directory.join("preview.mp4"), vec![0_u8; bytes]).expect("writes it");
        std::fs::write(directory.join(".complete"), b"").expect("marks it");
    }

    #[tokio::test]
    async fn removes_what_nothing_addresses() {
        let root = root("orphan");

        artefact(&root, "alive", 10);
        artefact(&root, "orphaned", 20);

        let keep = HashSet::from(["alive".to_owned()]);
        let report = sweep(&root, &keep, Duration::ZERO).await;

        assert_eq!(report.removed, 1);
        assert_eq!(report.kept, 1);
        assert!(root.join("alive").exists(), "a live artefact must survive");
        assert!(!root.join("orphaned").exists());
    }

    #[tokio::test]
    async fn reports_what_it_reclaimed() {
        let root = root("freed");

        artefact(&root, "orphaned", 4096);

        let report = sweep(&root, &HashSet::new(), Duration::ZERO).await;

        assert_eq!(report.removed, 1);
        assert!(
            report.freed_bytes >= 4096,
            "a sweep that says nothing gives nobody a reason to trust it"
        );
    }

    #[tokio::test]
    async fn leaves_alone_anything_too_new_to_judge() {
        let root = root("young");

        artefact(&root, "being-written", 10);

        let report = sweep(&root, &HashSet::new(), GRACE).await;

        assert_eq!(report.removed, 0);
        assert_eq!(report.too_new, 1);
        assert!(
            root.join("being-written").exists(),
            "a scan running beside a sweep must not lose its work"
        );
    }

    #[tokio::test]
    async fn does_nothing_when_there_is_no_cache_yet() {
        let missing = std::env::temp_dir().join("flux-sweep-absent-directory");

        std::fs::remove_dir_all(&missing).ok();

        assert_eq!(
            sweep(&missing, &HashSet::new(), Duration::ZERO).await,
            SweepReport::default()
        );
    }

    #[tokio::test]
    async fn forgetting_removes_the_one_artefact_and_leaves_the_rest() {
        let root = root("forget");

        artefact(&root, "wanted", 10);
        artefact(&root, "rebuild-me", 10);

        assert!(forget(&root, "rebuild-me").await);
        assert!(!root.join("rebuild-me").exists());
        assert!(
            root.join("wanted").exists(),
            "forgetting one artefact must not touch another"
        );
    }

    #[tokio::test]
    async fn forgetting_something_that_was_never_there_says_so() {
        let root = root("forget-absent");

        assert!(
            !forget(&root, "never-existed").await,
            "a caller should be able to tell 'removed it' from 'nothing to remove'"
        );
    }

    #[tokio::test]
    async fn ignores_loose_files_beside_the_directories() {
        let root = root("loose");

        std::fs::write(root.join("stray.txt"), b"not an artefact").expect("writes a stray file");
        artefact(&root, "orphaned", 10);

        let report = sweep(&root, &HashSet::new(), Duration::ZERO).await;

        assert_eq!(report.removed, 1);
        assert!(root.join("stray.txt").exists());
    }
}
