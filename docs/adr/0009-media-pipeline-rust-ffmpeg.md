# ADR-0009: Rust media service supervising FFmpeg as a child process

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

The media pipeline handles probing, transcode session lifecycle, hardware
acceleration, HLS/DASH packaging, segment caching, and byte-range delivery. It is
the most performance-sensitive and most failure-prone part of the system.

An early framing was "a Rust compiler for FFmpeg interaction." Two design
questions sit under that: whether to link FFmpeg's libraries or drive its CLI,
and where the process boundary sits.

### Licensing is a first-order constraint, not a footnote

Linking FFmpeg via FFI (`ffmpeg-next`, `ffmpeg-sys`) creates a derivative work
subject to FFmpeg's licence. FFmpeg's core is LGPL, but the builds anyone
actually wants — with x264 and x265 — require `--enable-gpl`, making the result
GPL. Linking that into our binary would place the whole distributed application
under the GPL.

For a project whose premise is a third-party plugin ecosystem and possible
commercial hosting, that is a decision with permanent consequences. Invoking
FFmpeg as a separate executable over a process boundary does not create a
derivative work, which is precisely why Jellyfin, Plex, and effectively every
other media server in this category do it that way. It is not laziness.

## Decision

**A Rust service (`apps/transcoder`) that supervises FFmpeg as a child process.**
No FFI, no linking. `tokio` + `axum`, communicating with the API server over a
Unix domain socket (ADR-0006) behind the `TranscodeTransport` seam.

### Responsibilities

- **Capability probing at startup** — enumerate available hardware acceleration
  (VAAPI, QSV, NVENC/NVDEC, AMF, VideoToolbox, RKMPP), verify each with a real
  test encode rather than trusting device-node presence, and publish a capability
  document the negotiator in ADR-0011 consumes. Detecting a `/dev/dri` node that
  cannot actually encode is a classic source of "transcoding is broken" reports.
- **Media probing** — container, streams, codecs, profiles, levels, HDR metadata,
  audio channel layouts, subtitle tracks.
- **Session lifecycle** — build the FFmpeg invocation from a negotiated plan,
  spawn, parse progress, enforce timeouts, clean up on client disconnect.
- **Segment packaging and cache** — HLS and DASH output, LRU eviction against the
  `/transcodes` ceiling.
- **Byte-range delivery** for direct play and remux, where Rust's throughput and
  low memory overhead matter most.

### Design rules

1. **The FFmpeg command line is constructed from a typed plan, never from string
   concatenation at call sites.** A `TranscodePlan` struct is the only input to
   invocation building. This makes the command deterministic, unit-testable
   without spawning anything, and loggable in full for support.
2. **Every session records its full plan, resolved command, and decision
   rationale.** This feeds the "why did this transcode?" explainer in ADR-0011.
3. **FFmpeg version and build are detected and asserted at startup**, with
   required features checked explicitly. We ship a known-good build in the image
   and support a user-supplied binary path with a clear compatibility warning.
4. **A crashed FFmpeg child is a retryable job, not a service outage.** The
   supervisor classifies exit codes: hardware failure (retry once on software),
   input error (fail the session, surface to the user), and resource exhaustion
   (queue).
5. **Hardware failure falls back to software automatically, once, and the
   fallback is surfaced in the admin UI.** Silent CPU-melting fallback is how
   users end up with a server at 100% load and no idea why.

## Consequences

### What this gets us

Our licence stays ours. A segfault in a codec library kills a child process
rather than the media server. FFmpeg can be upgraded, or swapped for a user's
own build, without recompiling anything. Rust gives us predictable memory use
and strong throughput on segment delivery, and a good story for the concurrency
in session management.

### What this costs us

Process spawn overhead per session (tens of milliseconds — negligible against
transcode start latency). Progress must be parsed from FFmpeg's output rather
than read from a structured API, which is brittle across versions and is the
main reason for rule 3. Some fine-grained control available through the C API is
simply not reachable via the CLI; where that matters we will need creative use of
filter graphs rather than direct frame access.

A Rust toolchain becomes a build prerequisite (mitigated in ADR-0001).

### What this forecloses

Frame-level processing in our own code — custom filters, ML-based upscaling,
scene analysis — without either a separate purpose-built process or revisiting
the FFI decision under a GPL-compatible licence. Worth noting as a real limit
before someone proposes an "AI enhance" feature.

## Alternatives considered

**FFI bindings via `ffmpeg-next`.** Rejected primarily on licensing, secondarily
on stability. The performance advantage is small because the work is dominated
by encoding, not by process boundaries.

**GStreamer.** A genuine pipeline API with better structural control and LGPL
plugins. Rejected: much smaller pool of contributors who know it, weaker
coverage of the odd containers and codecs found in real personal libraries, and
hardware acceleration support that is less battle-tested across the range of
homelab GPUs.

**Transcoding in Node by shelling out to FFmpeg.** Simpler and one less
language. Rejected: byte-range delivery and segment serving under concurrent
load is exactly where Node's single-threaded model performs worst, and this is
the one component where sustained throughput is the product.

**Reimplementing codec handling in Rust (`rav1e`, `dav1d`, etc.).** Rejected as
a wholesale approach — the breadth of formats in real libraries is FFmpeg's
entire value. Individual Rust encoders may be added later as _additional_
backends where they win, without displacing FFmpeg.

## Revisit when

- FFmpeg's progress output changes in a way that makes parsing untenable.
- A feature genuinely requires frame-level access, forcing a licensing review.
- A Rust-native encoder measurably beats FFmpeg's for a codec we care about.
