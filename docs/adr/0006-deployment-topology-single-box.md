# ADR-0006: Single-box Docker deployment topology

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

The target deployment is a homelab: one machine, Docker or Docker Compose,
typically 4–32 GB RAM, often with an Intel iGPU or a low-end NVIDIA card for
transcoding, media on a NAS mount or local array. The operator is technical but
is not running Kubernetes and does not want to.

We nonetheless intend to support multi-node transcoding later, so the topology
must not make that a rewrite.

## Decision

**Two containers. One image for the application, one for Postgres.**

```
┌─ container: streamer ─────────────────────────────┐
│  PID 1: node (Hono API, plugin broker, scheduler) │
│     ├─ spawns: transcoder (Rust)  <- /run/tc.sock │
│     └─ spawns: plugin processes   <- IPC          │
│  devices: /dev/dri  (or nvidia runtime)           │
└───────────────────────────────────────────────────┘
        │ TCP 5432
┌─ container: postgres ─────────────────────────────┐
└───────────────────────────────────────────────────┘
```

The Node process supervises the Rust transcoder as a child process, communicating
over a **Unix domain socket**. Rationale: one GPU device mapping instead of two,
no TCP loopback overhead for high-rate progress messages, one health check, one
log stream, one restart policy.

**The transport is abstracted behind a `TranscodeTransport` interface.** Moving
to a remote transcode pool means constructing it with a TCP or gRPC address; no
call site changes. This is the single seam that keeps multi-node cheap.

### Volumes

| Mount         | Mode   | Purpose                                                  |
| ------------- | ------ | -------------------------------------------------------- |
| `/config`     | rw     | Database-adjacent state, plugin installs, keys, settings |
| `/media`      | **ro** | User's library                                           |
| `/cache`      | rw     | Metadata, artwork, trickplay images                      |
| `/transcodes` | rw     | Segment output, size-capped, tmpfs-capable               |

**`/media` is mounted read-only, and this is an architectural invariant, not a
default.** The server never writes to a user's library. No metadata sidecars, no
renamed files, no "organise" feature that touches source media. Anything that
would write to the library is out of scope for the server and belongs to a
separate opt-in tool with its own writable mount. This constraint buys
disproportionate user trust in a category where people are protective of
irreplaceable collections, and it is far easier to hold from day one than to
retrofit.

### Resource discipline

- Concurrent transcode sessions are capped by configuration, defaulting **low**
  (2). A homelab box that becomes unresponsive because four people pressed play
  is the classic failure mode of this software class.
- `/transcodes` has a configured size ceiling with LRU eviction. Filling the
  host disk with segment output must be impossible, not merely unlikely.
- The transcoder child runs at a lower scheduling priority than the API process,
  so the UI stays responsive under transcode load.
- Plugin processes have memory ceilings and idle shutdown (ADR-0007).

### Health and lifecycle

The container reports unhealthy if the transcoder child is not reachable over its
socket. The Node supervisor restarts a crashed transcoder with backoff and
surfaces the event in the admin UI, rather than failing silently — a dead
transcoder that looks healthy produces "playback just spins forever" reports that
are miserable to diagnose remotely.

## Consequences

### What this gets us

A `docker compose up` install with one device mapping and one set of logs.
Sub-millisecond IPC to the transcoder. A clear seam for future scale-out.

### What this costs us

The application image contains both a Node runtime and a Rust binary plus
FFmpeg, so it is large — likely 400 MB or more. Multi-arch builds (amd64, arm64)
take real CI time. A crash in the supervisor takes down transcoding with it,
which a separate container would survive.

### What this forecloses

Independently scaling or independently updating the transcoder in the default
deployment. Users who want that will need a non-default compose file, which we
should ship as a documented "advanced" variant once the transport seam is proven.

## Alternatives considered

**Transcoder as a third container by default.** Cleaner isolation and independent
restarts, but requires GPU device mapping in two places, a second health check,
and inter-container networking — meaningfully more for a user to get right. We
keep it as a documented advanced option rather than the default.

**Single container including Postgres.** Rejected in ADR-0005.

**Kubernetes-first with a Helm chart.** Rejected as the primary target; it is
appropriate as a community-contributed deployment path later, not as the shape
the architecture optimises for.

## Revisit when

- Users credibly want a transcode pool across multiple machines.
- The combined image size or multi-arch build time becomes a release bottleneck.
