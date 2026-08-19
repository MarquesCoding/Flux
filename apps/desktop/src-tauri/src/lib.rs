//! The desktop host: a window, and the application inside it.
//!
//! Everything a viewer sees is `packages/screens`, the same code the browser runs. This crate is
//! only what a browser would otherwise have been — a window to draw in and a process to own it.

/// Opens the window and runs until it closes.
///
/// # Errors
///
/// Returns the error Tauri raised where the window could not be built or the event loop could not
/// be started, so the caller decides what to say rather than this deciding to panic.
pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default().run(tauri::generate_context!())
}
