//! What the whole deployment is using, where Linux will say.
//!
//! ADR-0006 puts both halves of Flux in one container, and the container's
//! entrypoint starts them as siblings. That makes the API server invisible to
//! anything walking the process tree from here: it is nobody's child, and the
//! half of Flux doing the most allocating is the half a process walk cannot
//! see. The cgroup can see it, because the cgroup is the container — and it
//! also knows the ceiling the container is held to, which host RAM does not.
//!
//! Nothing here is Linux-only by declaration. Off Linux these files are simply
//! not there, every read fails, and the answer is that there is no cgroup to
//! read — which is the same answer a caller needs to handle anyway.

use std::path::Path;

/// Where Linux mounts the cgroup filesystem.
const CGROUP_ROOT: &str = "/sys/fs/cgroup";

/// What a version one hierarchy writes as its limit when there is none.
///
/// A page counter at its maximum rather than a word, so the only way to tell
/// "no limit" from "a very large limit" is to recognise the number.
const NO_LIMIT: u64 = 1 << 60;

/// What everything inside the deployment is using, and what it is allowed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CgroupMemory {
    pub used_bytes: u64,
    /// The ceiling the deployment is held to, where one is set.
    pub limit_bytes: Option<u64>,
}

/// Reads what the container this is running in is using.
///
/// Nothing where there is no cgroup to read, which is every development
/// machine that is not Linux.
pub async fn memory() -> Option<CgroupMemory> {
    read_at(Path::new(CGROUP_ROOT)).await
}

/// Reads the memory figures from a cgroup filesystem mounted somewhere.
///
/// Takes the root so that a test can hand it a directory of files rather than
/// needing a container to run in.
///
/// @param root - Where the cgroup filesystem is mounted.
pub(crate) async fn read_at(root: &Path) -> Option<CgroupMemory> {
    match read_unified(root).await {
        Some(reading) => Some(reading),
        None => read_legacy(root).await,
    }
}

/// Reads a version two hierarchy.
///
/// Trusted wherever these files exist: the root of a version two hierarchy
/// carries no `memory.current` at all, so a machine that is not in a container
/// answers nothing here rather than answering for the whole machine.
async fn read_unified(root: &Path) -> Option<CgroupMemory> {
    let used = number(&root.join("memory.current")).await?;
    let cache = field(&root.join("memory.stat"), "inactive_file")
        .await
        .unwrap_or(0);

    Some(CgroupMemory {
        used_bytes: used.saturating_sub(cache),
        limit_bytes: number(&root.join("memory.max")).await,
    })
}

/// Reads a version one hierarchy.
///
/// Believed only when a limit is set, because version one is not namespaced
/// the way version two is: outside a container its root reports the whole
/// machine, and reporting the whole machine as Flux is the fault this is here
/// to fix. A limit is the one signal from inside that these figures describe a
/// container rather than a host.
async fn read_legacy(root: &Path) -> Option<CgroupMemory> {
    let directory = root.join("memory");

    let used = number(&directory.join("memory.usage_in_bytes")).await?;
    let limit = number(&directory.join("memory.limit_in_bytes"))
        .await
        .filter(|limit| *limit < NO_LIMIT)?;
    let cache = field(&directory.join("memory.stat"), "total_inactive_file")
        .await
        .unwrap_or(0);

    Some(CgroupMemory {
        used_bytes: used.saturating_sub(cache),
        limit_bytes: Some(limit),
    })
}

/// The number a cgroup file holds, where it holds one.
///
/// Nothing for the word a hierarchy writes when a limit is not set, which is
/// the same nothing a missing file gives.
async fn number(path: &Path) -> Option<u64> {
    tokio::fs::read_to_string(path)
        .await
        .ok()?
        .trim()
        .parse()
        .ok()
}

/// One field of a `memory.stat`, by name.
///
/// Wanted for the file pages the kernel is holding on Flux's behalf and would
/// drop the moment anything needed the room. Counting them as memory in use is
/// how a service that has read a few large files comes to look like a service
/// about to run out; `docker stats` takes them off for the same reason.
///
/// @param path - The `memory.stat` to read.
/// @param field - The name at the start of the line wanted.
async fn field(path: &Path, field: &str) -> Option<u64> {
    let text = tokio::fs::read_to_string(path).await.ok()?;

    text.lines().find_map(|line| {
        let (name, value) = line.split_once(' ')?;

        (name == field).then(|| value.trim().parse().ok())?
    })
}

#[cfg(test)]
mod tests {
    use super::{read_at, CgroupMemory};

    async fn write(path: &std::path::Path, contents: &str) {
        tokio::fs::create_dir_all(path.parent().expect("a file is in a directory"))
            .await
            .expect("the directory can be made");
        tokio::fs::write(path, contents)
            .await
            .expect("the file can be written");
    }

    fn root(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("flux-cgroup-{name}"));

        std::fs::remove_dir_all(&path).ok();

        path
    }

    #[tokio::test]
    async fn says_nothing_where_there_is_no_cgroup_to_read() {
        assert_eq!(read_at(&root("absent")).await, None);
    }

    #[tokio::test]
    async fn reads_what_the_container_is_using() {
        let root = root("unified");

        write(&root.join("memory.current"), "268435456\n").await;
        write(&root.join("memory.max"), "1073741824\n").await;

        assert_eq!(
            read_at(&root).await,
            Some(CgroupMemory {
                used_bytes: 268_435_456,
                limit_bytes: Some(1_073_741_824),
            })
        );
    }

    #[tokio::test]
    async fn does_not_count_pages_the_kernel_would_drop_on_demand() {
        let root = root("cache");

        write(&root.join("memory.current"), "1000\n").await;
        write(
            &root.join("memory.stat"),
            "anon 400\ninactive_file 600\nslab 20\n",
        )
        .await;

        assert_eq!(
            read_at(&root).await.map(|reading| reading.used_bytes),
            Some(400)
        );
    }

    #[tokio::test]
    async fn reports_a_container_with_no_ceiling_as_having_none() {
        let root = root("unlimited");

        write(&root.join("memory.current"), "5000\n").await;
        write(&root.join("memory.max"), "max\n").await;

        assert_eq!(
            read_at(&root).await,
            Some(CgroupMemory {
                used_bytes: 5000,
                limit_bytes: None,
            })
        );
    }

    #[tokio::test]
    async fn falls_back_to_the_older_hierarchy() {
        let root = root("legacy");

        write(&root.join("memory/memory.usage_in_bytes"), "900\n").await;
        write(&root.join("memory/memory.limit_in_bytes"), "2000\n").await;
        write(
            &root.join("memory/memory.stat"),
            "total_inactive_file 300\n",
        )
        .await;

        assert_eq!(
            read_at(&root).await,
            Some(CgroupMemory {
                used_bytes: 600,
                limit_bytes: Some(2000),
            })
        );
    }

    #[tokio::test]
    async fn refuses_an_older_hierarchy_with_no_limit_rather_than_answering_for_the_machine() {
        let root = root("legacy-host");

        write(&root.join("memory/memory.usage_in_bytes"), "900\n").await;
        write(
            &root.join("memory/memory.limit_in_bytes"),
            "9223372036854771712\n",
        )
        .await;

        assert_eq!(read_at(&root).await, None);
    }

    #[tokio::test]
    async fn takes_a_field_only_by_its_whole_name() {
        let root = root("fields");

        write(&root.join("memory.current"), "1000\n").await;
        write(&root.join("memory.stat"), "total_inactive_file 900\n").await;

        assert_eq!(
            read_at(&root).await.map(|reading| reading.used_bytes),
            Some(1000),
            "a version two reading takes inactive_file, not something ending in it"
        );
    }
}
