# ADR-0022: The application is a package; a client is a host that installs a platform

- **Status:** Accepted
- **Date:** 2026-08-18
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

Every line of the front end lived in `apps/web`. That was right while a browser
was the only client, and it is what stands between Valence and a desktop
application that is more than a web page in a window frame —
[VAL-8](https://linear.app/valence-streaming/issue/VAL-8/featclient-desktop-application)
leaves exactly that open: "How much of `apps/web` is reused as-is versus
rebuilt? Ideally almost all of it."

Measuring first changed the shape of the answer. Of the 119 files outside
`components/`, **94 touched no browser API at all** — the query layer, the
realtime protocol, sharing, history, profiles, the session. They were portable
already and simply in the wrong place. Only four of them reached anything that
was not, and between them they wanted three things: somewhere to keep a
preference, what to call this client, and which running client this is.

Two further seams appeared once the boundary was drawn rather than assumed:
opening the realtime socket, which a browser derives from the page's own
address; and a `MoodLight`, which the shell was borrowing from ValenceUI.

## Decision

**The application is `@valence/client`. A client is a host.** The package holds what
Valence _is_ — what the server is asked, what the answers mean, what is worth
caching. `apps/web` holds what a browser _is_: an entry point, a router, a
service worker, the Shaka engine, and one implementation of each port.

**A host installs a platform on the way up.**

```ts
installPlatform({ store, describeThisClient, thisClientId, openSocket });
```

Four ports, because four is what the moved code actually needed. Not the six
groups the ticket guessed at: casting, push and the small browser affordances
are used by screens, and screens have not moved.

**Installed once, not passed down.** The code that needs a platform is plain
functions — a reader called from a query has no React context to reach into.
`platformInUse()` throws where nothing was installed, which is deliberate: a
client that forgets to say what it is fails at once instead of quietly behaving
as though nobody is watching and no preference was ever chosen.

**The boundary is enforced rather than described.** ESLint refuses `@ValenceWeb/*`
and `@ValenceUI/*` inside the package. The application does not reach into a client
and does not draw; a shape both need belongs to `@ValenceContracts`.

## Consequences

### What this gets us

**A second client is now a host, not a rewrite.** 97 modules and 894 tests move
to it untouched. What a desktop client must write is four small functions and a
player.

**The seam VAL-8 is actually about is now a seam.** `detectClientLabel` reads a
user agent and is portable; asking a browser for one is the host's. The same
split is where `detectDeviceProfile` goes when a desktop client declares the
wider, honestly-measured profile that is the entire argument for building one.

**The application needs no browser to be true.** Not one file under
`packages/client` reads `document`, `window`, `localStorage` or `navigator`, and
849 of its 894 tests pass with the environment set to plain Node. The 45 that do
not are six files of React hook tests, which want a renderer rather than a
browser — a native client would supply a different one and the hooks would be the
same. Tests install a platform that keeps things in a `Map`.

### What this costs us

**`components/` did not move.** 185 files and 20,796 lines of screens are still
in `apps/web`, and they are the larger half. Some are as portable as the 94.

**A branded type does not survive the package boundary.** `queryOptions()` marks
a query key with the type of its data, and TypeScript emits that mark as a
reference to a `unique symbol` it never imports. Inside the package the brand
works; across it, `setQueryData` cannot infer its own updater. Six call sites in
`apps/web` now say the type themselves. This is a TypeScript limitation rather
than something wrong with the split, and it will bite every future cache write
from a screen.

**Two test helpers had to split.** The cache scope is the application's; the
router-aware one is the web's, because the router is the web's.

### What this forecloses

Nothing yet. ValenceUI is untouched and still draws with `className`, so it serves
a browser and anything embedding one — Tauri and Electron both. A React Native
client would need a second renderer against the same component contracts, which
is a larger question this deliberately does not answer.

## Alternatives considered

**Several packages** — reading, playback, session. More boundaries to maintain
than the code has natural seams for at this size, and every one of them a place
to put something in the wrong package.

**A platform passed down through React context.** More explicit, and testable
without a registry. It cannot reach the plain functions that make up most of the
package, which is most of what needs it.

**Move `components/` too.** Twice the change, and it would have buried the part
that matters — the ports — under twenty thousand lines of screens.

**Leave it and let the desktop client import `apps/web`.** What VAL-8 feared:
whatever it reused would arrive with a browser attached.

## Revisit when

A second client exists. Four ports is what one host needed; the second will find
the ones this one never had to name.

`components/` is split. The ports below it will already be there, which is the
point of doing this first.
