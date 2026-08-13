use std::env;
use std::path::PathBuf;
use std::time::Duration;

use flux_transcoder::router::{create_router, AppState};
use flux_transcoder::session::{SessionConfig, SessionRegistry};
use flux_transcoder::{capability, probe};

const DEFAULT_FFMPEG: &str = "ffmpeg";
const DEFAULT_FFPROBE: &str = "ffprobe";
const DEFAULT_SOCKET: &str = "/run/flux-transcoder.sock";
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
/// forget. `FLUX_TRANSCODER_ADDR` and `FLUX_TRANSCODER_SOCKET` stay for a
/// deployment that puts the two halves on different machines, where the two
/// addresses genuinely are different things.
///
/// A variable set to nothing counts as one not set at all: a compose file that
/// names a variable it has no value for exports an empty string, which is not
/// a path and should not be taken for one.
fn listen_target(read: &impl Fn(&str) -> Option<String>) -> ListenTarget {
    let configured = |variable: &str| read(variable).filter(|value| !value.trim().is_empty());

    if let Some(address) = configured("FLUX_TRANSCODER_ADDR") {
        return ListenTarget::Address(address);
    }

    if let Some(socket) = configured("FLUX_TRANSCODER_SOCKET") {
        return ListenTarget::Socket(socket);
    }

    let shared =
        configured("TRANSCODER_URL").and_then(|url| socket_from_url(&url).map(str::to_owned));

    ListenTarget::Socket(shared.unwrap_or_else(|| DEFAULT_SOCKET.to_owned()))
}

fn session_config(ffmpeg: String) -> SessionConfig {
    let defaults = SessionConfig::default();

    SessionConfig {
        ffmpeg,
        device: from_env("FLUX_VAAPI_DEVICE").unwrap_or(defaults.device),
        cache_root: env::var("FLUX_TRANSCODE_DIR").map_or(defaults.cache_root, PathBuf::from),
        idle_timeout: env::var("FLUX_SESSION_IDLE_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .map_or(defaults.idle_timeout, Duration::from_secs),
        max_concurrent: env::var("FLUX_MAX_CONCURRENT_TRANSCODES")
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
                println!("reaped {collected} idle session(s)");
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
        let budget = flux_transcoder::session_sweep::Budget::default();

        loop {
            let live = registry.live_ids().await;
            let report = flux_transcoder::session_sweep::evict(&root, &live, &budget).await;

            if report.removed > 0 {
                println!(
                    "reclaimed {} spent transcode(s), {} bytes",
                    report.removed, report.freed_bytes
                );
            }

            tokio::time::sleep(SWEEP_INTERVAL).await;
        }
    });
}

async fn serve(registry: SessionRegistry, ffprobe: String) {
    let state = AppState {
        registry: registry.clone(),
        ffprobe,
        trickplay: flux_transcoder::trickplay::TrickplayRegistry::new(),
        monitor: flux_transcoder::monitor::Monitor::new(flux_transcoder::monitor::Journal::new()),
        queue: flux_transcoder::queue::WorkQueue::new(background_jobs()),
        media_roots: env::var("FLUX_MEDIA_ROOTS")
            .map(|value| value.split(':').map(PathBuf::from).collect())
            .unwrap_or_default(),
    };

    eprintln!(
        "flux-transcoder running {} background jobs at once",
        background_jobs()
    );

    state.monitor.watch_graphics();
    state
        .monitor
        .watch_cache(state.registry.config().cache_root.clone());

    let router = create_router(state);

    spawn_reaper(registry.clone());
    spawn_sweeper(registry.clone());

    let result = match listen_target(&from_env) {
        ListenTarget::Address(address) => {
            println!("flux-transcoder listening on {address}");

            match tokio::net::TcpListener::bind(&address).await {
                Ok(listener) => axum::serve(listener, router).await,
                Err(error) => {
                    eprintln!("could not bind {address}: {error}");
                    eprintln!("set FLUX_TRANSCODER_ADDR to an interface this process can bind");
                    return;
                }
            }
        }
        ListenTarget::Socket(socket) => {
            let _ = tokio::fs::remove_file(&socket).await;

            println!("flux-transcoder listening on {socket}");

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

/// The most background jobs to run at once, unless told otherwise.
///
/// Each is an ffmpeg process that will happily take every core it is given, so
/// the useful number is well below the core count: half of them leaves a
/// machine responsive while a library is worked through, and the ceiling keeps
/// a big server from running out of memory rather than out of time.
///
/// One — which is what this was — leaves most of a machine idle for hours.
fn background_jobs() -> usize {
    const CEILING: usize = 4;

    if let Some(asked) = env::var("FLUX_BACKGROUND_JOBS")
        .ok()
        .and_then(|value| value.parse().ok())
    {
        return asked;
    }

    let cores = std::thread::available_parallelism().map_or(1, std::num::NonZeroUsize::get);

    (cores / 2).clamp(1, CEILING)
}

#[tokio::main]
async fn main() {
    let ffmpeg = setting("FLUX_FFMPEG", DEFAULT_FFMPEG);
    let ffprobe = setting("FLUX_FFPROBE", DEFAULT_FFPROBE);

    let arguments: Vec<String> = env::args().skip(1).collect();

    match arguments.split_first() {
        Some((command, rest)) if command == "probe" => {
            let Some(path) = rest.first() else {
                eprintln!("usage: flux-transcoder probe <file>");
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
            let capabilities =
                capability::detect_capabilities(&ffmpeg, &session_config(ffmpeg.clone()).device)
                    .await;

            println!(
                "{}",
                serde_json::to_string_pretty(&capabilities).unwrap_or_else(|_| "{}".to_owned())
            );
        }
        Some((command, _)) if command == "serve" => {
            let registry = SessionRegistry::new(session_config(ffmpeg));

            serve(registry, ffprobe).await;
        }
        _ => {
            println!("flux-transcoder {}", env!("CARGO_PKG_VERSION"));
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
            socket_from_url("unix:/tmp/flux.sock"),
            Some("/tmp/flux.sock")
        );
    }

    #[test]
    fn leaves_a_network_address_to_its_own_setting() {
        assert_eq!(socket_from_url("http://transcoder.internal:9000"), None);
    }

    #[test]
    fn binds_the_socket_the_server_was_told_to_dial() {
        let target = listen_target(&reading(&[("TRANSCODER_URL", "unix:/tmp/flux.sock")]));

        assert_eq!(target, ListenTarget::Socket("/tmp/flux.sock".to_owned()));
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
            ("TRANSCODER_URL", "unix:/tmp/flux.sock"),
            ("FLUX_TRANSCODER_ADDR", "0.0.0.0:9000"),
        ]));

        assert_eq!(target, ListenTarget::Address("0.0.0.0:9000".to_owned()));
    }

    #[test]
    fn lets_an_explicit_socket_win() {
        let target = listen_target(&reading(&[
            ("TRANSCODER_URL", "unix:/tmp/dialled.sock"),
            ("FLUX_TRANSCODER_SOCKET", "/tmp/bound.sock"),
        ]));

        assert_eq!(target, ListenTarget::Socket("/tmp/bound.sock".to_owned()));
    }

    #[test]
    fn treats_a_variable_set_to_nothing_as_unset() {
        let target = listen_target(&reading(&[
            ("FLUX_TRANSCODER_ADDR", ""),
            ("FLUX_TRANSCODER_SOCKET", "   "),
            ("TRANSCODER_URL", "unix:/tmp/flux.sock"),
        ]));

        assert_eq!(target, ListenTarget::Socket("/tmp/flux.sock".to_owned()));
    }
}
