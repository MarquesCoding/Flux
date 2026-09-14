use std::env;
use std::path::PathBuf;
use std::time::Duration;

use valence_transcoder::monitor::{record, LogLevel};
use valence_transcoder::router::{create_router, AppState};
use valence_transcoder::session::{SessionConfig, SessionRegistry};
use valence_transcoder::{capability, probe};

const DEFAULT_FFMPEG: &str = "ffmpeg";
const DEFAULT_FFPROBE: &str = "ffprobe";
const DEFAULT_SOCKET: &str = "/run/valence-transcoder.sock";
const UNIX_PREFIX: &str = "unix:";
const REAP_INTERVAL: Duration = Duration::from_secs(30);

/// How often spent transcode directories are reclaimed.
///
/// Nothing here is urgent — a directory nobody is watching costs disk and
/// nothing else — and the sweep reads the size of every one of them, so it is
/// not something to do every half minute beside the reaper.
const SWEEP_INTERVAL: Duration = Duration::from_secs(15 * 60);

fn setting(variable: &str, fallback: &str) -> String {
    env::var(variable).unwrap_or_else(|_| fallback.to_owned())
}

fn from_env(variable: &str) -> Option<String> {
    env::var(variable).ok()
}

/// Where the media service should listen.
#[derive(Debug, PartialEq, Eq)]
enum ListenTarget {
    Socket(String),
    Address(String),
}

/// Takes the socket path out of the address the server dials.
///
/// Only the `unix:` form is shared. One path both binds and dials a socket, so
/// a single setting genuinely serves both ends; a network address is not
/// shareable that way, because the host the server connects to is rarely the
/// interface this process should bind to. That case keeps its own setting.
fn socket_from_url(url: &str) -> Option<&str> {
    url.strip_prefix(UNIX_PREFIX)
}

/// Decides where to listen, most specific setting winning.
///
/// `TRANSCODER_URL` is the variable the server already dials, so leaving both
/// ends to it is what stops them disagreeing: there is no second setting to
/// forget. `VALENCE_TRANSCODER_ADDR` and `VALENCE_TRANSCODER_SOCKET` stay for a
/// deployment that puts the two halves on different machines, where the two
/// addresses genuinely are different things.
///
/// A variable set to nothing counts as one not set at all: a compose file that
/// names a variable it has no value for exports an empty string, which is not
/// a path and should not be taken for one.
fn listen_target(read: &impl Fn(&str) -> Option<String>) -> ListenTarget {
    let configured = |variable: &str| read(variable).filter(|value| !value.trim().is_empty());

    if let Some(address) = configured("VALENCE_TRANSCODER_ADDR") {
        return ListenTarget::Address(address);
    }

    if let Some(socket) = configured("VALENCE_TRANSCODER_SOCKET") {
        return ListenTarget::Socket(socket);
    }

    let shared =
        configured("TRANSCODER_URL").and_then(|url| socket_from_url(&url).map(str::to_owned));

    ListenTarget::Socket(shared.unwrap_or_else(|| DEFAULT_SOCKET.to_owned()))
}

fn session_config(ffmpeg: String, ffprobe: String) -> SessionConfig {
    let defaults = SessionConfig::default();

    SessionConfig {
        ffmpeg,
        ffprobe,
        device: from_env("VALENCE_VAAPI_DEVICE").unwrap_or(defaults.device),
        cache_root: env::var("VALENCE_TRANSCODE_DIR").map_or(defaults.cache_root, PathBuf::from),
        artefact_root: env::var("VALENCE_ARTEFACT_DIR")
            .map_or(defaults.artefact_root, PathBuf::from),
        idle_timeout: env::var("VALENCE_SESSION_IDLE_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .map_or(defaults.idle_timeout, Duration::from_secs),
        manifest_timeout: env::var("VALENCE_MANIFEST_TIMEOUT_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .map_or(defaults.manifest_timeout, Duration::from_secs),
        max_concurrent: env::var("VALENCE_MAX_CONCURRENT_TRANSCODES")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(defaults.max_concurrent),
    }
}

/// Collects idle sessions on a timer.
///
/// A closed browser tab sends no notification, so without this a transcode
/// outlives the viewer that asked for it.
fn spawn_reaper(registry: SessionRegistry) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(REAP_INTERVAL).await;

            let collected = registry.collect_idle().await;

            if collected > 0 {
                record(
                    LogLevel::Info,
                    "sessions",
                    &format!("reaped {collected} idle session(s)"),
                );
            }
        }
    });
}

/// Reclaims spent transcode directories on a timer.
///
/// Separate from the reaper because they undo different things: that one frees
/// the process a closed tab left running, this one frees the disk a finished
/// transcode left behind. Collecting a session deliberately leaves its
/// directory, since the next viewer of the same thing plays it without
/// encoding anything — but nothing was ever giving that space back.
///
/// Far rarer than the reaper. A directory nobody is watching costs only disk,
/// and disk is what there is most of.
///
/// Sweeps before it first sleeps, because a restart is exactly when abandoned
/// directories exist: a service killed mid-transcode leaves one behind, and
/// waiting a quarter of an hour to notice serves nobody.
fn spawn_sweeper(registry: SessionRegistry) {
    let root = registry.config().cache_root.clone();

    tokio::spawn(async move {
        let budget = valence_transcoder::session_sweep::Budget::default();

        loop {
            let live = registry.live_ids().await;
            let report = valence_transcoder::session_sweep::evict(&root, &live, &budget).await;

            if report.removed > 0 {
                record(
                    LogLevel::Info,
                    "cache",
                    &format!(
                        "reclaimed {} spent transcode(s), {} bytes",
                        report.removed, report.freed_bytes
                    ),
                );
            }

            tokio::time::sleep(SWEEP_INTERVAL).await;
        }
    });
}

/// Says, once, whether previews will still be there after the next update.
///
/// The failure this exists for is silent by construction: everything works,
/// nothing errors, and the artefacts are gone at the next restart. An operator
/// finds out weeks later by noticing their library is rendering again. So the
/// service checks where it is about to write and says so at boot, where the
/// answer sits beside the version it was running when it mattered.
async fn report_durability(
    registry: &SessionRegistry,
    monitor: &valence_transcoder::monitor::Monitor,
) {
    let root = registry.config().artefact_root.clone();

    let Some(durability) = valence_transcoder::durability::of(&root).await else {
        return;
    };

    monitor
        .note_artefacts(valence_transcoder::monitor::ArtefactStore {
            root: root.display().to_string(),
            survives_restart: durability.survives_restart,
        })
        .await;

    if durability.survives_restart {
        record(
            LogLevel::Info,
            "cache",
            &format!(
                "previews and thumbnails are kept on {} ({})",
                durability.mount.display(),
                durability.filesystem
            ),
        );

        return;
    }

    record(
        LogLevel::Warn,
        "cache",
        &valence_transcoder::durability::warning(&root, &durability),
    );
}

async fn serve(registry: SessionRegistry, ffmpeg: String, ffprobe: String) {
    let journal = valence_transcoder::monitor::Journal::new();

    valence_transcoder::monitor::install_journal(journal.clone());

    record(
        LogLevel::Info,
        "service",
        &capability::describe_build(&ffmpeg, &capability::read_version(&ffmpeg).await),
    );

    let state = AppState {
        registry: registry.clone(),
        ffprobe,
        downloads: valence_transcoder::download::DownloadRegistry::new(),
        trickplay: valence_transcoder::trickplay::TrickplayRegistry::new(),
        previews: valence_transcoder::preview::PreviewRegistry::new(),
        monitor: valence_transcoder::monitor::Monitor::new(journal),
        queue: valence_transcoder::queue::WorkQueue::new(background_jobs()),
        media_roots: env::var("VALENCE_MEDIA_ROOTS")
            .map(|value| value.split(':').map(PathBuf::from).collect())
            .unwrap_or_default(),
    };

    record(
        LogLevel::Info,
        "service",
        &format!("running {} background jobs at once", background_jobs()),
    );

    state.monitor.watch_graphics();
    state
        .monitor
        .watch_cache(state.registry.config().artefact_root.clone());

    report_durability(&registry, &state.monitor).await;

    let router = create_router(state);

    spawn_reaper(registry.clone());
    spawn_sweeper(registry.clone());

    let result = match listen_target(&from_env) {
        ListenTarget::Address(address) => {
            record(
                LogLevel::Info,
                "service",
                &format!("listening on {address}"),
            );

            match tokio::net::TcpListener::bind(&address).await {
                Ok(listener) => axum::serve(listener, router).await,
                Err(error) => {
                    eprintln!("could not bind {address}: {error}");
                    eprintln!("set VALENCE_TRANSCODER_ADDR to an interface this process can bind");
                    return;
                }
            }
        }
        ListenTarget::Socket(socket) => {
            let _ = tokio::fs::remove_file(&socket).await;

            record(LogLevel::Info, "service", &format!("listening on {socket}"));

            match tokio::net::UnixListener::bind(&socket) {
                Ok(listener) => axum::serve(listener, router).await,
                Err(error) => {
                    eprintln!("could not bind {socket}: {error}");
                    eprintln!(
                        "set TRANSCODER_URL to {UNIX_PREFIX}<path> somewhere writable — the server dials the same variable"
                    );
                    return;
                }
            }
        }
    };

    if let Err(error) = result {
        eprintln!("server stopped: {error}");
    }

    registry.stop_all().await;
}

/// The most background renders to run at once, unless told otherwise.
///
/// One. This was worked out from the core count — half of them, capped at four
/// — on the reasoning that an ffmpeg process takes every core it is given. That
/// reasoning is about processors, and a render on a graphics chip is not bound
/// by processors: it costs a session and a share of the device's memory, of
/// which there are a fixed number however many cores sit beside them. Four
/// renders at once against one iGPU exhausted it, which read as
/// "-17 (File exists)" and an encoder that would not open; ten took the whole
/// API down with it.
///
/// Measured rather than reasoned about, twice over. Four sheet renders together
/// held about one core of twenty, so this work waits on a disk and not on a
/// processor and the cores were never the resource being shared. And Jellyfin,
/// reading the same library on the same machine without trouble, draws
/// thumbnails behind a lock of exactly one.
///
/// It costs less than it looks. Nothing waits on a render any more — a caller
/// is answered at once and asks again — so a queue of one is a queue, not a
/// stall, and the library is worked through in the same order either way.
fn background_jobs() -> usize {
    const AT_A_TIME: usize = 1;

    env::var("VALENCE_BACKGROUND_JOBS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(AT_A_TIME)
}

#[tokio::main]
async fn main() {
    let ffmpeg = setting("VALENCE_FFMPEG", DEFAULT_FFMPEG);
    let ffprobe = setting("VALENCE_FFPROBE", DEFAULT_FFPROBE);

    let arguments: Vec<String> = env::args().skip(1).collect();

    match arguments.split_first() {
        Some((command, rest)) if command == "probe" => {
            let Some(path) = rest.first() else {
                eprintln!("usage: valence-transcoder probe <file>");
                return;
            };

            match probe::probe_media(&ffprobe, &PathBuf::from(path)).await {
                Ok(result) => println!(
                    "{}",
                    serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_owned())
                ),
                Err(error) => eprintln!("probe failed: {error}"),
            }
        }
        Some((command, _)) if command == "capabilities" => {
            let capabilities = capability::detect_capabilities(
                &ffmpeg,
                &session_config(ffmpeg.clone(), ffprobe.clone()).device,
            )
            .await;

            println!(
                "{}",
                serde_json::to_string_pretty(&capabilities).unwrap_or_else(|_| "{}".to_owned())
            );
        }
        Some((command, _)) if command == "serve" => {
            let registry = SessionRegistry::new(session_config(ffmpeg.clone(), ffprobe.clone()));

            serve(registry, ffmpeg, ffprobe).await;
        }
        _ => {
            println!("valence-transcoder {}", env!("CARGO_PKG_VERSION"));
            println!("commands: serve, probe <file>, capabilities");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{listen_target, socket_from_url, ListenTarget, DEFAULT_SOCKET};

    fn reading(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let owned: Vec<(String, String)> = pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect();

        move |variable: &str| {
            owned
                .iter()
                .find(|(name, _)| name == variable)
                .map(|(_, value)| value.clone())
        }
    }

    #[test]
    fn takes_the_socket_the_server_dials() {
        assert_eq!(
            socket_from_url("unix:/tmp/valence.sock"),
            Some("/tmp/valence.sock")
        );
    }

    #[test]
    fn leaves_a_network_address_to_its_own_setting() {
        assert_eq!(socket_from_url("http://transcoder.internal:9000"), None);
    }

    #[test]
    fn binds_the_socket_the_server_was_told_to_dial() {
        let target = listen_target(&reading(&[("TRANSCODER_URL", "unix:/tmp/valence.sock")]));

        assert_eq!(target, ListenTarget::Socket("/tmp/valence.sock".to_owned()));
    }

    #[test]
    fn falls_back_to_the_packaged_socket_when_nothing_is_set() {
        let target = listen_target(&reading(&[]));

        assert_eq!(target, ListenTarget::Socket(DEFAULT_SOCKET.to_owned()));
    }

    #[test]
    fn keeps_the_packaged_socket_when_the_server_dials_over_the_network() {
        let target = listen_target(&reading(&[("TRANSCODER_URL", "http://transcoder:9000")]));

        assert_eq!(target, ListenTarget::Socket(DEFAULT_SOCKET.to_owned()));
    }

    #[test]
    fn lets_an_explicit_address_win() {
        let target = listen_target(&reading(&[
            ("TRANSCODER_URL", "unix:/tmp/valence.sock"),
            ("VALENCE_TRANSCODER_ADDR", "0.0.0.0:9000"),
        ]));

        assert_eq!(target, ListenTarget::Address("0.0.0.0:9000".to_owned()));
    }

    #[test]
    fn lets_an_explicit_socket_win() {
        let target = listen_target(&reading(&[
            ("TRANSCODER_URL", "unix:/tmp/dialled.sock"),
            ("VALENCE_TRANSCODER_SOCKET", "/tmp/bound.sock"),
        ]));

        assert_eq!(target, ListenTarget::Socket("/tmp/bound.sock".to_owned()));
    }

    #[test]
    fn treats_a_variable_set_to_nothing_as_unset() {
        let target = listen_target(&reading(&[
            ("VALENCE_TRANSCODER_ADDR", ""),
            ("VALENCE_TRANSCODER_SOCKET", "   "),
            ("TRANSCODER_URL", "unix:/tmp/valence.sock"),
        ]));

        assert_eq!(target, ListenTarget::Socket("/tmp/valence.sock".to_owned()));
    }
}
