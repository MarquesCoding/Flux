# ADR-0005: Postgres + Drizzle + pg-boss as the only datastore

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

We need durable storage for the library index, metadata, users and sessions,
playback state, plugin configuration, and media requests. We also need a job
queue for library scans, metadata refreshes, image fetching, transcode intake,
and request processing.

The deployment target is a single-box homelab Docker install (ADR-0006). Every
additional service in the compose file is another container to explain, another
volume to back up, another process competing for memory on a box that may have
8 GB total, and another thing that can fail at 2 a.m.

Jellyfin's use of SQLite is a well-known pain point: write lock contention
between the library scanner and active playback sessions produces the "database
is locked" failures that self-hosters regularly report.

## Decision

**Postgres is the only datastore.** No Redis, no SQLite, no separate search
index at launch.

- **ORM/query layer:** Drizzle, shared with better-auth's Drizzle adapter, so
  there is exactly one schema definition style and one migration toolchain.
- **Job queue:** `pg-boss`, backed by the same Postgres instance. It provides
  retries with backoff, scheduled and cron jobs, priorities, dead-letter
  handling, and job singleton keys — which covers every queue need we have
  identified.
- **Sessions:** in Postgres via better-auth (ADR-0004).
- **Full-text search:** Postgres native FTS with `pg_trgm` for fuzzy title
  matching, until measurement says otherwise.
- **Deployment:** Postgres runs as its own container in the shipped compose file.
  It is _not_ bundled into the application image.

## Consequences

### What this gets us

One backup story: `pg_dump` captures the entire application state including
queued jobs and sessions. One connection pool. Transactional enqueue — a library
scan can insert media rows and enqueue their metadata jobs in a single
transaction, so a crash mid-scan cannot leave orphaned work or lost jobs. That
property is genuinely hard to get with an external queue and is worth more than
the throughput we give up.

No write-lock contention between scanner and playback, which removes an entire
category of Jellyfin bug report.

### What this costs us

pg-boss is slower than Redis-backed BullMQ — it polls tables rather than using a
purpose-built queue structure. At our scale (a household's library, not a SaaS)
this is irrelevant, but it would matter if job volume grew by orders of
magnitude.

Postgres has a larger memory floor than SQLite and requires tuning guidance for
low-RAM boxes. We must ship sane `shared_buffers` / `work_mem` defaults for a
2 GB container and document them, or users on a Raspberry Pi will suffer.

Two containers instead of one. This is now the norm for self-hosted software of
this class and users accept it, but it is still more friction than a single
binary with an embedded database.

### What this forecloses

A true single-binary, zero-dependency distribution. If we later want a portable
desktop build ("Media Server for one person, no Docker"), we would need an
embedded Postgres or a second storage backend. Keeping all data access behind
Drizzle repositories rather than scattered raw SQL preserves that option at
moderate cost.

## Alternatives considered

**SQLite (like Jellyfin).** Rejected. The write-contention failure mode is the
specific problem we want to not have. Reconsider only for a hypothetical
single-user desktop build.

**Postgres + Redis + BullMQ.** Rejected for single-box. Redis buys throughput we
do not need and costs a container, a volume, a memory allocation, and the loss of
transactional enqueue. Revisit if we build a multi-node transcode cluster.

**Postgres bundled into the app image via supervisord.** Rejected. It makes the
container "just work" on day one and makes us responsible for Postgres backup,
major-version upgrade, and corruption recovery support forever.

**Meilisearch or Typesense for search.** Deferred, not rejected. Postgres FTS
with trigram matching is adequate for library search; add a dedicated index only
when measurement on a large library shows it is not.

## Revisit when

- A library of 100k+ items makes Postgres FTS search latency user-visible.
- We build multi-node transcoding, which changes the queue calculus.
- We commit to a single-binary desktop distribution.
