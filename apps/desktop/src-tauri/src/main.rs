//! Starts the desktop client.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() -> std::process::ExitCode {
    match flux_desktop_lib::run() {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(problem) => {
            eprintln!("Flux could not open a window: {problem}");

            std::process::ExitCode::FAILURE
        }
    }
}
