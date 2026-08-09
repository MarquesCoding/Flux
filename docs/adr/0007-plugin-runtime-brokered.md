# ADR-0007: Brokered plugin runtime, process-per-plugin

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Superior plugin support is the project's central premise. Jellyfin's model lets
plugins reach into server internals via reflection, which has two consequences:
almost any core refactor breaks plugins, and an installed plugin has the full
privileges of the server process — including filesystem access to the user's
entire library and network access anywhere.

We have decided to broker plugins from the start rather than retrofit isolation
later, on the reasoning that retrofitting security onto a live ecosystem is close
to impossible: once plugins depend on ambient authority, taking it away breaks
all of them at once.

### Why `worker_threads` is not sufficient

The obvious implementation is one `worker_thread` per plugin. It does not
provide a security boundary. A worker can `require('fs')` and read anything the
server process can read. Node's permission model (`--permission`,
`--allow-fs-read`) is **process-wide**, so it cannot restrict one worker while
leaving the API server unrestricted. Worker isolation is a _fault_ boundary and
a _resource_ boundary, not a _security_ boundary.

If plugin code must not have ambient authority, it must be in its own process.

## Decision

**One child process per plugin, spawned with Node's permission model fully
locked down**, granted no filesystem, network, or subprocess access beyond its
own code directory. All capability comes back through broker RPC.

```
  plugin process  (no ambient authority)
        │
        │  structured-clone RPC only
        ▼
     broker  ──  grant table check  ──►  host services
```

### The three rules that make this hold

1. **Opaque handles, never paths.** A plugin receives `MediaHandle("m_8f3a")`,
   never `/media/films/Dune.mkv`. It calls `media.probe(handle)` or
   `media.readChunk(handle, range)` and the broker resolves the handle against
   the grant table. Path traversal ceases to be a category of bug that can exist.

2. **Declared egress only.** There is no socket access. `http.fetch()` is
   host-implemented and checked against the manifest's domain allowlist, with
   redirects re-checked against the same list.

3. **Serializable payloads only across the boundary.** No functions, no proxies,
   no shared memory, no object identity. This is the constraint that keeps a
   `wasmtime` runtime an _additive_ second host rather than a rewrite, and it is
   very easy to violate accidentally under deadline pressure. It should be
   enforced by the RPC layer's own types, not by discipline.

### Host services exposed through the broker

`log`, `settings` (schema-declared, admin-rendered), `kv` (namespaced per
plugin), `http.fetch` (allowlisted), `media.*` (handle-based), `library.query`
(read-only projections, never entity graphs), `events.subscribe`
(topic-allowlisted), and `jobs.enqueue` (rate-limited).

### Manifest

Declares `name`, `version`, `apiVersion` semver range, extension points
implemented, capabilities requested, and a settings JSON Schema that
auto-renders the admin configuration form.

### Extension points

Narrow, versioned contracts — `MetadataProvider`, `LibraryScanner`,
`AuthProvider`, `NotificationChannel`, `RequestBackend`, `TranscodeProfileProvider`,
`UIContribution`. Each versions independently. **The host supports the current
and previous major of each contract.** A plugin outside the supported range is
refused at load with a clear, actionable error, never allowed to fail obscurely
at runtime.

Note that `AuthProvider` is load-at-boot only, per ADR-0004.

### Resource limits

Each plugin process has a memory ceiling, a CPU share, lazy start on first use,
and idle shutdown after a configurable period. Short-lived hooks may be served
from a warm pool.

## Consequences

### What this gets us

A plugin cannot read the user's library, exfiltrate data, or call home unless
the manifest declared it and the admin approved it. Core internals can be
refactored freely, because plugins depend on versioned contracts rather than on
our object graph. A malicious or merely buggy plugin cannot take down the server.

Two capabilities fall out almost free, and both are things no competitor offers:

- **Install-time permission disclosure and update diffs.** "This plugin now also
  requests network access to `example.com`" shown before it runs.
- **A broker call log in development mode.** Plugin authors see every host call,
  its arguments, and whether it was granted or denied. This is a debugging
  experience that does not currently exist in this software category, and it
  costs nearly nothing once the broker exists.

### What this costs us

**Roughly 40–60 MB RSS per plugin process.** Ten active plugins is on the order
of half a gigabyte on a box that may have 8 GB. This is the real price of the
decision and it must be stated in the minimum-requirements documentation, not
discovered by users. Lazy start and idle shutdown mitigate but do not eliminate
it.

IPC latency on every host call, which makes chatty plugin APIs expensive.
Batch-oriented host methods must be designed deliberately — `library.query`
returning a page, not `getItem` called in a loop.

Meaningfully more work than in-process plugins: an RPC layer, a grant table, a
handle registry, a supervisor, and a permission UI, all before the first plugin
runs.

### What this forecloses

Plugins that extend the server in ways we did not anticipate. A brokered model
can only offer what the broker exposes, so genuinely novel plugin ideas will
require a core change to add an extension point. This is a real loss of
flexibility and we accept it deliberately: it is the same trade that makes the
system safe and refactorable. The mitigation is responsiveness — treat
"extension point request" as a first-class issue type with a fast path.

## Alternatives considered

**In-process, trusted plugins (Jellyfin's model).** Fastest to build and to run.
Rejected: no security boundary, and every core refactor becomes an ecosystem
break.

**`worker_threads` with a broker.** Rejected. Provides fault and resource
isolation but not security isolation, while _appearing_ to provide it — the worst
outcome, because it would let us make a safety claim we cannot back.

**WASM component model via `wasmtime` from day one.** The strongest isolation
and genuinely language-agnostic. Rejected as the _initial_ runtime because the
tooling burden on plugin authors is high today and it would slow the first
ecosystem meaningfully. Rule 3 above exists specifically to keep this as a
future additive runtime.

**Full container-per-plugin.** Rejected for a single-box homelab target;
overhead and Docker-socket requirements are both unacceptable.

## Revisit when

- WASM component tooling matures enough that plugin authors would not suffer.
- Memory overhead proves prohibitive on typical hardware in real installs.
- Extension-point requests reveal a systematic gap in what the broker exposes.
