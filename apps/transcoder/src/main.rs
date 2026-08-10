use std::env;
use std::path::PathBuf;
use std::time::Duration;

use flux_transcoder::router::{create_router, AppState};
use flux_transcoder::session::{SessionConfig, SessionRegistry};
use flux_transcoder::{capability, probe};

const DEFAULT_FFMPEG: &str = "ffmpeg";
const DEFAULT_FFPROBE: &str = "ffprobe";
const DEFAULT_SOCKET: &str = "/run/flux-transcoder.sock";
const REAP_INTERVAL: Duration = Duration::from_secs(30);

fn setting(variable: &str, fallback: &str) -> String {
    env::var(variable).unwrap_or_else(|_| fallback.to_owned())
}

fn session_config(ffmpeg: String) -> SessionConfig {
    let defaults = SessionConfig::default();

    SessionConfig {
        ffmpeg,
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

async fn serve(registry: SessionRegistry, ffprobe: String) {
    let state = AppState {
        registry: registry.clone(),
        ffprobe,
        media_roots: env::var("FLUX_MEDIA_ROOTS")
            .map(|value| value.split(':').map(PathBuf::from).collect())
            .unwrap_or_default(),
    };

    let router = create_router(state);

    spawn_reaper(registry.clone());

    let result = if let Ok(address) = env::var("FLUX_TRANSCODER_ADDR") {
        {
            println!("flux-transcoder listening on {address}");

            match tokio::net::TcpListener::bind(&address).await {
                Ok(listener) => axum::serve(listener, router).await,
                Err(error) => {
                    eprintln!("could not bind {address}: {error}");
                    return;
                }
            }
        }
    } else {
        {
            let socket = setting("FLUX_TRANSCODER_SOCKET", DEFAULT_SOCKET);
            let _ = tokio::fs::remove_file(&socket).await;

            println!("flux-transcoder listening on {socket}");

            match tokio::net::UnixListener::bind(&socket) {
                Ok(listener) => axum::serve(listener, router).await,
                Err(error) => {
                    eprintln!("could not bind {socket}: {error}");
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
            let capabilities = capability::detect_capabilities(&ffmpeg).await;

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
