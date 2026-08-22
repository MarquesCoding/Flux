//! What the artefact cache is holding.
//!
//! Valence writes a preview clip and a set of scrub sheets per item and keeps a
//! working directory per live transcode. None of it is small, all of it is
//! rebuildable, and until now none of it was visible: the sweep that reclaims
//! it reports into a log, so the only way to learn what Valence was hoarding was
//! to go and look at the disk.
//!
//! Measured by walking directories, which is real I/O against a cache that can
//! hold thousands of them. That is why nothing here is called from a request:
//! it runs on a timer and hands out the last answer it got.

use std::path::Path;

use serde::Serialize;

/// The directories that are kinds rather than artefacts.
///
/// Everything else directly under the cache root is a live transcode's working
/// directory, named for the session that owns it.
const KINDS: [&str; 2] = ["previews", "trickplay"];

/// What one kind of artefact is costing.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtefactUse {
    /// How many of them there are, counted as directories rather than files,
    /// because one preview is a directory of segments and a person counting
    /// previews means the clip.
    pub count: usize,
    pub bytes: u64,
}

/// What the whole cache is holding, by kind.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheUse {
    pub previews: ArtefactUse,
    pub trickplay: ArtefactUse,
    /// Working directories for transcodes that are running now.
    pub sessions: ArtefactUse,
    /// When this was measured, so a page can say how old the figure is rather
    /// than implying it is live.
    pub at_ms: u64,
}

/// Everything under a directory, however deep.
///
/// Iterative rather than recursive so that a cache someone has nested deeply,
/// or a symlink loop, cannot take the stack down with it.
pub(crate) async fn size_of(directory: &Path) -> u64 {
    let mut total = 0;
    let mut pending = vec![directory.to_path_buf()];

    while let Some(next) = pending.pop() {
        let Ok(mut entries) = tokio::fs::read_dir(&next).await else {
            continue;
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let Ok(metadata) = entry.metadata().await else {
                continue;
            };

            if metadata.is_dir() {
                pending.push(entry.path());
            } else if metadata.is_file() {
                total += metadata.len();
            }
        }
    }

    total
}

/// Adds up the directories directly inside one, which is one artefact each.
async fn measure(directory: &Path) -> ArtefactUse {
    let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
        return ArtefactUse::default();
    };

    let mut use_ = ArtefactUse::default();

    while let Ok(Some(entry)) = entries.next_entry().await {
        if entry.metadata().await.is_ok_and(|found| found.is_dir()) {
            use_.count += 1;
            use_.bytes += size_of(&entry.path()).await;
        }
    }

    use_
}

/// Every live transcode's working directory, which is whatever is left.
///
/// Named by session rather than gathered under a kind, so this is defined by
/// what it is not. Reading it that way means a new kind of artefact added
/// beside the others shows up as a session and is wrong, which is a smaller
/// problem than a new kind that shows up nowhere at all and is invisible.
async fn measure_sessions(root: &Path) -> ArtefactUse {
    let Ok(mut entries) = tokio::fs::read_dir(root).await else {
        return ArtefactUse::default();
    };

    let mut use_ = ArtefactUse::default();

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().into_owned();

        if KINDS.contains(&name.as_str()) {
            continue;
        }

        if entry.metadata().await.is_ok_and(|found| found.is_dir()) {
            use_.count += 1;
            use_.bytes += size_of(&entry.path()).await;
        }
    }

    use_
}

/// What the cache is holding right now.
pub async fn read(root: &Path) -> CacheUse {
    CacheUse {
        previews: measure(&root.join("previews")).await,
        trickplay: measure(&root.join("trickplay")).await,
        sessions: measure_sessions(root).await,
        at_ms: crate::queue::now_ms(),
    }
}

#[cfg(test)]
mod tests {
    use super::read;

    async fn write(path: &std::path::Path, bytes: usize) {
        tokio::fs::create_dir_all(path.parent().expect("a file has a parent"))
            .await
            .expect("the directory can be made");
        tokio::fs::write(path, vec![0_u8; bytes])
            .await
            .expect("the file can be written");
    }

    fn root(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("valence-usage-{name}"));

        std::fs::remove_dir_all(&path).ok();

        path
    }

    #[tokio::test]
    async fn says_nothing_is_there_when_nothing_is() {
        let usage = read(&root("empty")).await;

        assert_eq!(usage.previews.count, 0);
        assert_eq!(usage.previews.bytes, 0);
    }

    #[tokio::test]
    async fn counts_an_artefact_as_a_directory_rather_than_as_its_files() {
        let root = root("counting");

        write(&root.join("previews/abc/one.ts"), 100).await;
        write(&root.join("previews/abc/two.ts"), 50).await;

        let usage = read(&root).await;

        assert_eq!(usage.previews.count, 1, "one preview, not two segments");
        assert_eq!(usage.previews.bytes, 150);
    }

    #[tokio::test]
    async fn keeps_the_kinds_apart() {
        let root = root("kinds");

        write(&root.join("previews/abc/clip.ts"), 100).await;
        write(&root.join("trickplay/def/sheet.jpg"), 30).await;

        let usage = read(&root).await;

        assert_eq!(usage.previews.bytes, 100);
        assert_eq!(usage.trickplay.bytes, 30);
        assert_eq!(usage.sessions.count, 0, "a kind is not a session");
    }

    #[tokio::test]
    async fn counts_what_is_not_a_kind_as_a_live_transcode() {
        let root = root("sessions");

        write(&root.join("previews/abc/clip.ts"), 10).await;
        write(&root.join("ses_1/index.m3u8"), 20).await;
        write(&root.join("ses_2/index.m3u8"), 5).await;

        let usage = read(&root).await;

        assert_eq!(usage.sessions.count, 2);
        assert_eq!(usage.sessions.bytes, 25);
    }

    #[tokio::test]
    async fn adds_up_files_however_deep_they_sit() {
        let root = root("depth");

        write(&root.join("previews/abc/nested/deeper/clip.ts"), 70).await;

        assert_eq!(read(&root).await.previews.bytes, 70);
    }

    #[tokio::test]
    async fn says_when_it_looked() {
        let root = root("timing");

        write(&root.join("previews/abc/clip.ts"), 1).await;

        assert!(read(&root).await.at_ms > 0);
    }
}
