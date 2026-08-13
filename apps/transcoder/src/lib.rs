//! Flux media service.
//!
//! Owns every interaction with `FFmpeg`. `FFmpeg` is driven as a child process
//! rather than linked, which keeps Flux's licence its own and turns a codec
//! crash into a retryable job instead of a dead server. See ADR-0009.

#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

pub mod cache_sweep;
pub mod cache_usage;
pub mod capability;
pub mod fingerprint;
pub mod frame;
pub mod graphics;
pub mod integrity;
pub mod media;
pub mod monitor;
pub mod preview;
pub mod probe;
pub mod queue;
pub mod router;
pub mod session;
pub mod session_sweep;
pub mod subtitle;
pub mod transcode_plan;
pub mod trickplay;
