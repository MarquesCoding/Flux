# ADR-0023: Screens are part of the application, not of a host

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

[0022](0022-the-application-is-a-package-and-a-client-is-a-host.md) moved the
portable front end into `packages/client` and stopped there, on purpose:
"`components/` is still in `apps/web` — 185 files and 20,796 lines, the larger
half. That is the next split." [FLUX-147](https://linear.app/flux-streaming/issue/FLUX-147/refactorweb-separate-the-application-from-the-browser-it-happens-to)
said the same in advance, that sorting the screens out was "its own piece of
work once the seams below them exist". The seams now exist.

Leaving it there would have made 0022 mostly ceremonial. A desktop client that
takes `packages/client` and supplies its own ports still gets no screens, which
is to say it gets a data layer and a blank window. The half that was moved is
the half that was already easy.

The question is whether a screen is a browser thing. It is not. A screen draws
with FluxUI, which draws with `className` and HTML elements, and reads through
`packages/client`, which reaches a browser only through `Platform`. What made
the screens browser-shaped was the directory they sat in and two habits that
directory permitted.

## Decision

**`packages/screens` holds every screen and the route tree.** `apps/web` holds
what a browser is and nothing else: the entry point, the four platform ports,
the realtime socket and the service worker. Eight source files and five tests.

**ESLint refuses `@FluxWeb/*` inside `packages/screens`,** as it already does
inside `packages/client`. Anything a screen needs from a client is a port on
`Platform`, or becomes one. `@FluxUI/*` stays allowed — unlike the application
layer, screens are what draws.

**The route tree moves with the screens.** It is composed entirely of them; the
only host-shaped thing in it is scroll restoration, which TanStack does
generically. A host chooses a history and mounts a router. It does not decide
which addresses Flux serves.

## Consequences

### What this gets us

A second client is now an entry point, four ports and a stylesheet. That claim
is checkable rather than hopeful: `apps/web/src` is thirteen files, and every
one of them is either the entry point, a platform port or a browser API.

The boundary is enforced rather than described, and was checked against a
deliberate violation before being relied on.

Three things the old directory had been hiding came out with it:

**The push service worker had been broken since 0022.** It moved to
`packages/client` with the rest of `notifications/`, while `vite.config.ts` kept
building `src/notifications/pushWorker.ts` — a path that no longer existed. It
is a service worker, so it belongs to a browser; it now sits in `apps/web` and
the config points at it.

**One screen was reaching for a browser.** `AdminArea` tested its realtime
feed by stubbing the global `WebSocket`, which only worked because the tests ran
inside the host. It now drives `Platform.openSocket`. The assertion that the
address is `/api/realtime` moved to `apps/web`, beside the code that decides it,
which is also the first test `openRealtimeSocket` has had.

**`packages/client` was never added to the coverage checker** when 0022 created
it. Both it and `packages/screens` are listed now.

### What this costs us

**A build step before a typecheck.** `apps/web` references `packages/screens`,
so the package has to be built before the host typechecks. `tsc --build` does it,
but a clean checkout that runs `pnpm --filter @flux/web typecheck` first will see
a TS6305 rather than a helpful message.

**A second long test setup.** `packages/screens` needs the same jsdom shims the
host needed — media queries, pointer capture, media elements, canvas — so that
file is now duplicated between the two, differing only in which platform it
installs. Screens install the in-memory one, fresh per test.

**The `DataTag` tax from 0022 applies to more code.** `queryOptions()` brands a
query key with the type of its data and TypeScript emits that brand as a
reference to a `unique symbol` it never imports, so cache writes across the
boundary state their own types. The six that did so in `apps/web` now do it in
`packages/screens`. It did not get worse; it got more visible.

**The coverage average gate stays red.** It was already red: on `main`,
`apps/web` measures 89.24% of lines against a 90% floor, and nothing enforced it
because `pnpm test` does not pass `--coverage`. After this change the same files
measure 89.31%. This decision neither causes that nor fixes it, and closing the
gap is not smuggled in here.

### What this forecloses

`apps/web` stops being the place to put something quickly. Anything that is not
the entry point, a port or a browser API now has to go somewhere that has an
opinion about it.

A screen can no longer read a browser API directly. Where one needs to, the
answer is a new port on `Platform` and a host implementation, which is a
deliberate cost — it is what makes the next client cheap.

## Alternatives considered

**Leave the screens in `apps/web` and have a desktop client import from it.**
Rejected: an application is not a dependency. It would also leave the browser
host owning everything, which is the position this decision exists to end.

**Split the screens into several packages by feature.** Rejected as premature.
No boundary between them has been felt yet, and inventing four is four chances
to draw one in the wrong place.

**Keep the route tree in the host.** Tried first, and it made a cycle: a screen
test needs a router above it, and the router is built from the screens. The
honest fix was not a test-only router but noticing that the tree was never the
host's.

## Revisit when

A second host exists and something in `packages/screens` turns out to be
browser-shaped after all — the likeliest candidates are `attachShaka` and
anything that measures the viewport.

`packages/screens` grows large enough that its test run is the one people wait
for, at which point splitting it by feature stops being premature.
