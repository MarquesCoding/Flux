# ADR-0026: The desktop client is a window onto the server, not a copy of it

- **Status:** Proposed
- **Date:** 2026-08-20
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0025](0025-the-desktop-client-is-electron.md) settled what the desktop client
is built on. This settles what it _is_, which turned out to be the question that
decided everything else about it.

A desktop client can get Flux's screens into a window two ways. It can ship them —
bundle `packages/screens`, serve them from itself, and talk to the server over the
API. Or it can load them from the server, the way a browser does.

**The first was tried, in full, and every problem it produced had the same cause.**
A window serving its own pages is a stranger to the server it talks to:

- Its cookies are cross-site, so the engine will not send them.
- `Set-Cookie` is a forbidden response header and `Cookie` a forbidden request
  header, so no script can hold one either.
- Every request is cross-origin, so the server must name the window as trusted and
  answer preflights.
- A path resolves against the window, so every request and every picture has to be
  moved onto the server first.
- A passkey belongs to an origin, and the window's origin is not the server's.

Each of those was solved, and each solution needed the next one. A bearer token,
because there was no cookie. A relay for the two cookies the token plugin does not
carry, because a second factor needs them. A token in the WebSocket address,
because an upgrade cannot set a header. Then Electron, and a cookie jar in the main
process; then the jar written into the engine's own store, because a header added
by hand makes a picture stop being a picture and fail a CORS check the server was
answering correctly; then the lifetime carried across, because otherwise everybody
signs in again at every launch; then credentials on forty fetches, because a
cross-origin `fetch` sends no cookies; then a sign-in in a real browser with an
authorization code deep-linked back, because passkeys need a real origin.

All of it worked. None of it should have been necessary.

## Decision

**The window loads the server's pages. It does not serve its own.**

`showTheApplication` reads the address somebody gave and calls `loadURL` on it.
That is the architecture.

**What this client ships is one screen** — which Flux is yours — shown until
somebody has said, and never drawn again after. From there the window is a browser
looking at their server, with the things a browser cannot have built around it.

**Nothing about authentication is this client's business.** Signing in, a second
factor, a passkey, a saved password and a password manager all work because they
are happening on the server's own origin in Chromium, exactly as they do in a
browser. better-auth needs no Electron configuration, and Flux needs no Electron
integration package.

This is how Jellyfin's desktop client works, and the reasons are the same.

## Consequences

### What this gets us

**There is nothing to keep in step.** No token, no relay, no jar, no credentials
flag, no trusted origin for the desktop, no deep link, no scheme, no authorization
code. Two thousand lines went with the decision, and the main process is seven
kilobytes.

**Everything a browser can do, this client can do**, including the things Flux has
not built yet, because they arrive with the server's pages rather than needing a
desktop release.

**The client and the server cannot fall out of step.** A bundled client can be
older than the server it points at; this one is the server's own application by
construction. For self-hosted software, where the operator upgrades when they like,
that is worth more than it sounds.

**Plugins and themes come for free.** Anything the server serves to a browser it
serves to this window, so a plugin an operator installs is installed here too, with
nothing to ship and nothing to auto-update.

**A path is a path again.** `serverUrl` and the port that answered where the server
is are gone, and ninety-two call sites name a path and nothing else.

### What this costs us

**The window needs the server to show anything.** There is no offline shell. For a
client whose entire purpose is streaming from that server this is close to already
true, but it is a real difference: a bundled client could at least draw itself and
explain, and this one shows what a browser shows when a site is unreachable.

**The look of the desktop client is the server's to decide.** A viewer on an old
server gets that server's Flux. That is the point, but it means the desktop client
cannot lead the web application by a release.

**Native features must reach across a page the server drew.** Media keys, a tray,
downloads and Rich Presence live in the preload script and the main process, and
they attach to a page from somewhere else. That is ordinary Electron work, and it
is where this client's remaining complexity will be.

**A first launch has to be got right.** The one screen this client ships is the
only thing standing between somebody and a blank window, so what it does when an
address is wrong, unreachable, or later moves is the whole of its own experience.

### What this forecloses

Shipping a different Flux than the server's — a desktop-only screen, a beta client
against a stable server, an offline library. Any of those means bundling the
application again, and bundling it brings back everything above.

## Alternatives considered

**Bundling the screens and talking to the API.** Built, in two framework
generations, and described at length above. It is not that it cannot be made to
work — it was working — it is that the working version is a large amount of
machinery whose only purpose is to pretend the window is not a stranger.

**Bundling the screens and signing in through a browser.** The last version of the
above, and the one better-auth documents for Electron. It removes the auth
machinery and keeps everything else: the cross-origin requests, the moved paths,
the trusted origin, and a sign-in that leaves the application to happen somewhere
else.

**A native shell around a native player.** Discards `packages/screens`, which is
the half of the application that took two refactors to make portable.

## Revisit when

Somebody wants Flux in a window while the server is off — downloads for a flight,
say. That is the one thing this decision genuinely gives up, and it would need a
bundled shell beside the window rather than instead of it.

The server gains an application shell that is expensive enough to want cached
locally, at which point a service worker on the server's own origin is the answer
rather than bundling.
