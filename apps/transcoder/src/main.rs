use std::env;
use std::path::PathBuf;

use flux_transcoder::{capability, probe};

const DEFAULT_FFMPEG: &str = "ffmpeg";
const DEFAULT_FFPROBE: &str = "ffprobe";

fn binary(variable: &str, fallback: &str) -> String {
    env::var(variable).unwrap_or_else(|_| fallback.to_owned())
}

#[tokio::main]
async fn main() {
    let ffmpeg = binary("FLUX_FFMPEG", DEFAULT_FFMPEG);
    let ffprobe = binary("FLUX_FFPROBE", DEFAULT_FFPROBE);

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
        _ => {
            println!("flux-transcoder {}", env!("CARGO_PKG_VERSION"));
            println!("commands: probe <file>, capabilities");
        }
    }
}
