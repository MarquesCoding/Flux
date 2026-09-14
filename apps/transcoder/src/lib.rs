//! Valence media service.
//!
//! Owns every interaction with `FFmpeg`. `FFmpeg` is driven as a child process
//! rather than linked, which keeps Valence's licence its own and turns a codec
//! crash into a retryable job instead of a dead server.

#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

pub mod boundaries;
pub mod cache_sweep;
pub mod cache_usage;
pub mod capability;
pub mod cgroup;
pub mod chains;
pub mod concurrency;
pub mod download;
pub mod durability;
pub mod fingerprint;
pub mod frame;
pub mod graphics;
pub mod integrity;
pub mod keyframes;
pub mod media;
pub mod monitor;
pub mod playlist;
pub mod preview;
pub mod probe;
pub mod queue;
pub mod render_registry;
pub mod router;
pub mod session;
pub mod session_sweep;
pub mod steps_aside;
pub mod subtitle;
pub mod transcode_plan;
pub mod trickplay;
