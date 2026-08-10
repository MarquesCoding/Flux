//! Flux media service.
//!
//! Owns every interaction with `FFmpeg`. `FFmpeg` is driven as a child process
//! rather than linked, which keeps Flux's licence its own and turns a codec
//! crash into a retryable job instead of a dead server. See ADR-0009.

#![cfg_attr(test, allow(clippy::expect_used, clippy::unwrap_used))]

pub mod capability;
pub mod colour;
pub mod fingerprint;
pub mod frame;
pub mod media;
pub mod probe;
pub mod router;
pub mod session;
pub mod subtitle;
pub mod transcode_plan;
pub mod trickplay;
