# ADR-0026: A client with no shared origin carries a bearer token

- **Status:** Proposed
- **Date:** 2026-08-19
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0025](0025-the-desktop-client-is-tauri.md) settled what the desktop client is
built on. Starting it surfaced two things that decision had not accounted for, and
[FLUX-157](https://linear.app/flux-streaming/issue/FLUX-157/featclient-the-application-has-no-way-to-be-told-where-its-server-is)
dealt with the first: the application had no way to be told where its server is.

This is the second, and it is the harder one. **A desktop window cannot hold a
session.**

Forty-three requests carry `credentials: 'same-origin'`, and better-auth is
configured with a relative `basePath`. Both are correct in a browser, where the
page came from the Flux server and the cookie is first-party. A Tauri window
serves its pages from itself, so the server is cross-site, and a cookie set by
`https://flux.example.com` is simply not sent by a page at `tauri://localhost`.

This is not a CORS setting. `SameSite=None; Secure` would be necessary and is not
sufficient: WKWebView, which ADR-0025 chose, applies Intelligent Tracking
Prevention to cross-site cookies, and a custom scheme is not an origin it will
relax for. The mechanism a browser client depends on is unavailable to a desktop
one, and no amount of server configuration makes it available.

## Decision

**A client with no shared origin authenticates with a bearer token. A client
served by the server keeps its cookie.**

The two are not a migration from one to the other. A cookie is the better
credential where it works: it is `HttpOnly`, so a cross-site script cannot read
it, and nothing in the application ever holds it. A token in a device store is
readable by whatever runs in that window, which is an acceptable trade only where
the alternative is no session at all.

**The server needs no change.** `bearer()` is already installed —
`apps/server/src/auth/Auth.ts:105`. It reads `Authorization: Bearer <token>`,
validates it and injects it as the session cookie internally, so every existing
session lookup, permission check and route guard works untouched. Its own comment
is "Converts bearer token to session cookie". Nothing about the server learns that
a second kind of client exists.

**The client keeps the token in the device store**, which is the port ADR-0022
already defined for exactly this: something a client knows how to keep and the
application does not. A browser answers that it has no token and sends none.

**Not JWT.** better-auth ships a `jwt` plugin and it is the wrong tool here. It
issues signed tokens with a JWKS endpoint so that somebody _other than the issuer_
can verify them without asking. Flux's server is the only thing that ever
verifies a Flux session, so JWT would add a key pair, a JWKS route, expiry and
refresh handling to solve a problem this architecture does not have. The bearer
plugin reuses the session that already exists and already expires.

### How the token is come by

better-auth returns it on any response that sets the session cookie, in a
`set-auth-token` header it also names in `Access-Control-Expose-Headers`. Signing
in, signing up and refreshing all produce one. The client reads that header, keeps
it, and sends it back on every request until it stops working.

### The socket is the one place a header will not go

A header on every request settles every request. It does not settle the one
connection, and that turned out to be a hole in this decision rather than in the
implementation of it —
[FLUX-161](https://linear.app/flux-streaming/issue/FLUX-161/featclient-the-realtime-socket-has-no-way-to-say-who-it-is-without-a).

A browser `WebSocket` constructor takes an address and a subprotocol list. There
is no API for a header on the upgrade, in any browser, and a WebView is a browser.
So the credential that works everywhere else cannot reach `/api/realtime`, the
upgrade is refused, and by
[ADR-0017](0017-realtime-one-socket-two-feeds.md) that one connection is
everything live: progress between devices, presence, the admin monitor, watch
parties, notifications. All of it absent, and the rest of the client looking fine.

**The token rides in the query string, and the server turns it back into the
header its session lookup already reads.** One line on each side. The lookup, the
guards and the feeds are untouched, exactly as with a request. A connection that
already carries an `authorization` header is left alone, so this can only add a
claim and never replace one.

The cost is a session-length credential in a URL, which is where proxies and
access logs write things down. That is real, and it is bounded: it is on one path,
to one server that the operator runs, and the operator running Flux is the person
whose logs those are. A browser client sends no token at all here — it has a
cookie, which the upgrade carries by itself.

**A single-use ticket was the better-looking answer and was not taken.** The
client would ask an authenticated endpoint for a short-lived token and open the
socket with that, keeping the long-lived one out of the URL. It costs an endpoint,
a store of outstanding tickets with expiry, a round trip before every connect, and
a reconnect path that has to fetch a fresh ticket before it can retry — the socket
reconnects, so that last one is not a detail. It is the right shape for a service
whose logs somebody else keeps. It can be built later without changing anything
the client shows, and the honest reason it is not being built now is that it buys
a smaller thing than it costs.

**A first message carrying the token** was the other candidate, and it means the
server holds unauthenticated connections open while it waits for one. That is a
thing to be careful about on a public endpoint, and being careful about it is more
code than either of the others.

### Two cookies bearer does not know about

`bearer` converts one cookie, the session one. The two-factor plugin sets two of
its own — the pending challenge, and the record of a device somebody chose to
trust — and reads them back from the `Cookie` header on the request that answers.
Neither reaches a client that cannot be sent a cookie, so a second factor could be
asked for and never answered: sign-in returns `twoFactorRedirect`, and every code
typed after it is refused.

A client cannot fix this by holding the cookie itself, either. `Set-Cookie` is a
forbidden response header and `Cookie` a forbidden request one, in every browser
engine, and a desktop window is a browser engine. What a script can read and write
is an ordinary header.

**So the server hands those two over in a header, and takes them back in one.**
This is `bearer`'s own trick rather than a new idea: it answers with
`set-auth-token` for precisely the same reason. `exposeAuthCookies` copies the
values out of `Set-Cookie` on the way out, `headersWithAuthCookies` writes them
back into `Cookie` on the way in, and the two-factor plugin is untouched — it
reads the cookie where it has always read it.

Two cookies and no others, named on the server. The session cookie is deliberately
not among them: `bearer` already carries it, and accepting it here would be a
second way to present a session, on a path built for something else. Both relayed
cookies are signed with the server's own secret, so a value that was not issued
here fails to verify a moment later. What a client can do with one is present a
value it was already given, which is what holding a cookie is.

**A browser is given none of this.** It has the real cookies, and a signed
challenge sitting in web storage beside them would be a credential in the open for
nothing in return. The client sends and stores the header only where
`whereTheServerIs` answers with something, which is exactly the condition this ADR
is about.

## Consequences

### What this gets us

A desktop client can hold a session at all, which is the whole of it. Nothing else
about FLUX-8 is reachable without this.

The browser is unchanged — same cookie, same headers, same bytes.

The server is unchanged. A single plugin, already enabled, is the entire server
side of supporting a second class of client.

### What this costs us

**A credential the application can read.** A cookie is `HttpOnly` and a token in
a device store is not. Anything running in that window can take it, and unlike a
cookie it travels wherever the client sends it. On a desktop client the window
runs only what Flux shipped, which is what makes this acceptable — it would not be
acceptable in a browser, and this decision does not do it there.

**Two credentials to keep working.** Every request path now has to work both ways,
and a change that only carries the cookie will pass every test in the browser and
fail entirely on desktop. That is a real trap and the reason the token is applied
at the same chokepoints `serverUrl` is, rather than per call.

**Sign-out has to reach both.** Clearing a cookie the client cannot see does not
clear a token the client is holding.

**A credential in a URL, on one path.** Named above, and worth counting here: it
is the one place this decision puts a token somewhere it can be written down by
something other than the client.

**A cookie relay to keep in step.** A better-auth plugin that starts setting a
cookie of its own gets the same treatment or silently fails on desktop, and the
failure looks like a feature that does nothing rather than an error. The list of
relayed cookies is one line in one file, which is the least bad version of that.

### What this forecloses

Storing a session anywhere the application cannot reach, on clients that need a
token. That is the trade being made rather than an accident.

A browser client authenticating by token, which this deliberately does not enable.
The cookie is better where it works, and offering both in one client would mean
choosing the weaker one by accident.

## Alternatives considered

**`SameSite=None; Secure` cookies and CORS.** The obvious answer, and it does not
work: WKWebView will not treat a custom scheme as an origin it relaxes tracking
prevention for. It would also weaken the browser's cookie to buy nothing there.

**better-auth's `jwt` plugin.** Solves third-party verification. Flux has no third
party.

**API keys, which Flux already has.** They exist and are the wrong shape: they
identify an integration rather than a person, are minted deliberately by an
operator, and carry no session, so none of the two-factor, passkey or profile
machinery would apply to somebody signing in on a desktop.

**Serving the desktop application from the server** so that it shares an origin.
Discards the offline case, makes the client useless when the server is
unreachable, and is most of the way back to a browser.

## Revisit when

Flux is deployed behind a proxy whose access logs somebody else keeps, at which
point the ticket described above stops being a trade and becomes the answer.

Tauri or WKWebView offers a first-party cookie store scoped to a configured
origin, which would make the cookie workable and this unnecessary.

A client appears that is neither trusted with a readable credential nor able to
hold a cookie — a shared or embedded device, say — at which point the trade above
needs restating rather than reusing.
