//! Whether what is written to a directory will still be there after a restart.
//!
//! A container's own filesystem is a scratch layer. Everything written to a
//! path that is not on a mount survives exactly as long as the container does,
//! and an update replaces the container — so an operator whose volume is
//! mapped one directory to the side of where Valence writes loses every
//! preview and every sheet on each update, having been told nothing at any
//! point. That is not a hypothetical: it is the ordinary result of adapting a
//! compose file, and nothing in the running service would ever mention it.
//!
//! So the service asks the question itself. The kernel publishes every mount
//! in this namespace, and a path is durable when the mount it falls under is
//! not the container's root and is not held in memory.
//!
//! This never refuses to start. Somebody trying Valence out with no volumes at
//! all is not making a mistake, and the answer to "where did my previews go" is
//! worth having in the log whether or not it was one.

use std::path::{Path, PathBuf};

use tokio::fs;

/// Where the kernel publishes the mounts of this namespace.
const MOUNTINFO: &str = "/proc/self/mountinfo";

/// Filesystems that lose what is written to them when the machine stops.
const IN_MEMORY: [&str; 2] = ["tmpfs", "ramfs"];

/// What a directory is written on, and whether that outlives the container.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Durability {
    /// The mount the directory falls under.
    pub mount: PathBuf,
    pub filesystem: String,
    pub survives_restart: bool,
}

/// One mount, as far as this question is concerned.
///
/// `mountinfo` puts the mount point in the fifth field and the filesystem type
/// in the first field after the ` - ` separator, and pads the middle with
/// optional fields whose number is not fixed — which is what the separator is
/// there to make readable.
fn parse_mount(line: &str) -> Option<(PathBuf, String)> {
    let (before, after) = line.split_once(" - ")?;
    let mount = before.split_whitespace().nth(4)?;
    let filesystem = after.split_whitespace().next()?;

    Some((PathBuf::from(mount), filesystem.to_owned()))
}

/// The mount a path falls under, which is the longest one it sits inside.
///
/// Longest wins because mounts nest: a volume at `/cache` and the container's
/// root at `/` both contain `/cache/artefacts`, and only the inner one says
/// anything true about it.
pub fn mount_of(mountinfo: &str, path: &Path) -> Option<(PathBuf, String)> {
    mountinfo
        .lines()
        .filter_map(parse_mount)
        .filter(|(mount, _)| path.starts_with(mount))
        .max_by_key(|(mount, _)| mount.components().count())
}

/// Whether a directory is somewhere its contents will outlive the container.
///
/// The container's root is the scratch layer, and an in-memory filesystem is
/// gone at the next boot however it is mapped — ADR-0006 calls `/transcodes`
/// tmpfs-capable, and an operator who takes it at its word should be told what
/// that costs rather than discover it.
fn judge(mount: &Path, filesystem: &str) -> bool {
    mount != Path::new("/") && !IN_MEMORY.contains(&filesystem)
}

/// What this machine says about a directory, where it will say anything.
///
/// Nothing outside Linux publishes `mountinfo`, and a machine that does not
/// answer is reported as silent rather than as a fault: a developer running
/// the service directly has no container to lose anything to.
pub async fn of(path: &Path) -> Option<Durability> {
    let mountinfo = fs::read_to_string(MOUNTINFO).await.ok()?;
    let (mount, filesystem) = mount_of(&mountinfo, path)?;

    Some(Durability {
        survives_restart: judge(&mount, &filesystem),
        mount,
        filesystem,
    })
}

/// What to tell an operator whose artefacts are about to be thrown away.
///
/// Names the directory, what it is on and what that means, because the fix is
/// a line in a compose file and nobody can write it from "previews are not
/// being kept".
#[must_use]
pub fn warning(path: &Path, durability: &Durability) -> String {
    let Durability {
        mount, filesystem, ..
    } = durability;

    format!(
        "previews and thumbnails are being written to {}, which is on {} ({filesystem}) — \
         nothing there survives this container being recreated, and an update recreates it. \
         Map a volume at that path, or point VALENCE_ARTEFACT_DIR at one that is mapped.",
        path.display(),
        mount.display()
    )
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::{judge, mount_of, parse_mount, warning, Durability};

    const MOUNTINFO: &str = "\
24 30 0:22 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw
30 0 0:29 / / rw,relatime - overlay overlay rw,lowerdir=/var/lib/docker
41 30 8:1 /var/lib/docker/volumes/stack_cache/_data /cache rw,relatime - ext4 /dev/sda1 rw
42 30 0:44 / /transcodes rw,relatime - tmpfs tmpfs rw,size=2097152k
43 30 0:51 /media /mnt/nas/artefacts rw,relatime - nfs4 10.0.0.2:/export rw
";

    fn found(path: &str) -> (PathBuf, String) {
        mount_of(MOUNTINFO, Path::new(path)).expect("every path falls under the root at worst")
    }

    #[test]
    fn reads_the_mount_point_and_filesystem_out_of_a_line() {
        let (mount, filesystem) =
            parse_mount("41 30 8:1 / /cache rw,relatime - ext4 /dev/sda1 rw").expect("a full line");

        assert_eq!(mount, Path::new("/cache"));
        assert_eq!(filesystem, "ext4");
    }

    #[test]
    fn says_nothing_about_a_line_it_cannot_read() {
        assert!(parse_mount("41 30 8:1 / /cache rw,relatime").is_none());
    }

    #[test]
    fn takes_the_innermost_mount_a_directory_sits_inside() {
        assert_eq!(found("/cache/artefacts/previews").0, Path::new("/cache"));
    }

    #[test]
    fn falls_back_to_the_container_root_where_nothing_is_mapped() {
        assert_eq!(found("/transcodes-elsewhere/previews").0, Path::new("/"));
    }

    #[test]
    fn never_reads_one_directory_as_another_whose_name_it_starts_with() {
        assert_eq!(
            found("/cached/previews").0,
            Path::new("/"),
            "/cached is not inside /cache"
        );
    }

    #[test]
    fn keeps_what_is_written_under_a_mapped_volume() {
        let (mount, filesystem) = found("/cache/artefacts");

        assert!(judge(&mount, &filesystem));
    }

    #[test]
    fn keeps_what_is_written_to_network_attached_storage() {
        let (mount, filesystem) = found("/mnt/nas/artefacts/trickplay");

        assert_eq!(filesystem, "nfs4");
        assert!(
            judge(&mount, &filesystem),
            "an operator putting artefacts on a NAS has done nothing wrong"
        );
    }

    #[test]
    fn loses_what_is_written_to_the_containers_own_filesystem() {
        let (mount, filesystem) = found("/previews");

        assert_eq!(mount, Path::new("/"));
        assert!(!judge(&mount, &filesystem));
    }

    #[test]
    fn loses_what_is_written_to_a_filesystem_held_in_memory() {
        let (mount, filesystem) = found("/transcodes/previews");

        assert_eq!(filesystem, "tmpfs");
        assert!(
            !judge(&mount, &filesystem),
            "a mapped tmpfs is still gone at the next boot"
        );
    }

    #[test]
    fn tells_an_operator_the_path_and_the_fix_rather_than_the_symptom() {
        let message = warning(
            Path::new("/transcodes"),
            &Durability {
                mount: PathBuf::from("/"),
                filesystem: "overlay".to_owned(),
                survives_restart: false,
            },
        );

        assert!(message.contains("/transcodes"));
        assert!(message.contains("overlay"));
        assert!(message.contains("VALENCE_ARTEFACT_DIR"));
    }
}
