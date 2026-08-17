# ADR-0017: Carry every live update on one WebSocket, split into a viewer feed and an admin feed

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

Flux had three server-sent event streams: the monitor report, the active session
list, and presence. Each was opened separately with `EventSource`, each
reimplemented its own lifecycle, and all three flowed one way only.

That arrangement had reached its limits for three reasons.

The first is a hard browser constraint. A browser allows roughly six concurrent
connections to an origin over HTTP/1.1. An administrator with a player open held
three of them permanently, leaving three for every ordinary request the page
makes. Each new live feature — a log tail, a viewer feed — took another, and the
page would have started stalling on its own fetches. This limit applies whatever
the traffic direction, so no amount of restraint about what to stream avoids it.

The second is that almost nothing was live for the people actually using Flux.
Presence aside, a viewer saw no change until they reloaded: not a title finishing
a scan, not a notification arriving, not their own name after changing it on
another device. The live plumbing served the operator watching the server, not
the household watching films.

The third is that the client needs to talk back. Choosing a log filter,
subscribing to a library, and saying which profile a tab is now acting as are all
client-to-server. On SSE each is a separate request that cannot be correlated
with the stream it affects.

## Decision

**One WebSocket per tab, at `/api/realtime`, carrying every live update.** No
component opens a connection of its own; a single client owns it and hands out
per-topic subscriptions.

**Two feeds over that one connection**, separated by permission rather than by
endpoint. Viewer topics — media, notifications, profile, presence, playback —
need only a session. Admin topics — monitor, sessions, logs — each name a
permission from the existing catalogue. An administrator's tab carries both.

**Entitlement is re-read on every message, not once at the upgrade.** A socket
authenticated at connect and trusted thereafter is a check that never runs again,
and roles are editable while a socket is held open. Readings are memoised for a
few seconds so a four-thousand-item scan does not become four thousand queries,
and the permission service is wrapped so that any change to a role forgets the
memo immediately. The wrapping is deliberate: there are eight routes that edit
permissions, and announcing at each call site is a thing that can be forgotten.

**The client is never trusted to filter.** A viewer's tab must not receive an
admin message even as something it would ignore, because discarding it on arrival
is not a permission check.

**Publishing never waits for a socket.** Events gather into a short window and
one is sent in their place, carrying a count of what it stood for. A scan is
neither slowed by a stalled client nor able to push thousands of frames at one.

**The registry is in-process**, which is consistent with the single-box topology
of [ADR-0006](0006-deployment-topology-single-box.md) and adds no datastore, so
[ADR-0005](0005-data-layer-postgres-drizzle-pgboss.md) stands unchanged.

**The three SSE endpoints and their `EventSource` consumers are removed.** Two
transports doing one job is worse than either alone.

## Consequences

### What this gets us

- One connection instead of three, with room for live features that would
  otherwise have run the page out of sockets.
- Live updates for viewers, not only operators.
- One authentication, one reconnect, one backoff, written once.
- A bidirectional channel, which is what [FLUX-15](https://linear.app/flux-streaming/issue/FLUX-15)
  needs and would otherwise have required building alongside the SSE stack.
- Presence keyed to the socket itself, so the thing that notices a tab arrive is
  the thing that notices it go.

### What this costs us

- **Reconnection is now ours.** `EventSource` retried on its own with a growing
  backoff and could replay from `Last-Event-ID`. A socket does none of that, so
  reconnection, backoff and resubscription are hand-written — and a feed that
  silently stops after a laptop sleeps is worse than polling, because nothing
  looks wrong.
- A tab that was away has a gap. Callers are told the connection resumed and
  refetch, rather than the feed pretending continuity it does not have.
- Development needs the Vite proxy to forward upgrades, which the string
  shorthand does not do. Getting this wrong breaks development while production
  works perfectly.
- Coalescing means a rapid series of changes arrives as one event with a count,
  not as each change. Anything needing every individual change must not use this.

### What this forecloses

- Consuming a feed with a plain `curl` against an SSE endpoint, which was a
  pleasant debugging property.
- Fanning out from more than one process without introducing something shared, so
  a multi-process deployment ([FLUX-49](https://linear.app/flux-streaming/issue/FLUX-49))
  would have to revisit this.

## Alternatives considered

**Keep SSE and add more streams.** Smaller change, and SSE genuinely reconnects
better. Lost to the six-connection limit, which no amount of care avoids, and to
needing a second mechanism for anything client-to-server.

**One SSE stream, multiplexed, with POSTs for the client-to-server half.** Keeps
free reconnection and solves the connection count. Lost because a request cannot
be correlated with the stream it affects, and because it is two mechanisms
presented as one.

**Polling.** Simplest and most robust. Lost because "did a notification arrive"
asked every few seconds by every tab is more load than a socket, and still feels
slow.

**Redis or another broker for fan-out.** Rejected: the registry is in-process
because Flux is one process. A broker earns its place when there is more than one
of something to coordinate, and there is not.

## Revisit when

- Flux supports more than one server process, at which point an in-process
  registry cannot fan out and this needs a shared one.
- A feature needs every individual change rather than a coalesced summary.
- HTTP/3 is the floor everywhere Flux runs, which removes the connection limit
  that is the strongest argument here — though not the bidirectional one.
