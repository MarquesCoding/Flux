# ADR-0026: A desktop client signs in through a browser, and carries the cookie it is given

- **Status:** Proposed
- **Date:** 2026-08-20
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR-0025](0025-the-desktop-client-is-electron.md) settled what the desktop client
is built on. This settles how somebody signs in to it, which is the question that
settled ADR-0025 in the first place.

A desktop window serves its own pages. Whatever the server is, it is somewhere
else, so nothing about signing in is the same as it is in a browser:

- The page has no origin the server shares, so its requests are cross-site.
- `Set-Cookie` is a forbidden response header and `Cookie` a forbidden request
  header, in every browser engine, so a script cannot hold a cookie itself even
  where the engine would let it keep one.
- A `<video>` element fetches every segment of everything anybody watches, and no
  script can put a header on those requests.

Forty-three requests carried `credentials: 'same-origin'` and better-auth was
configured with a relative `basePath`. Both are correct in a browser and neither
means anything in a window that served itself.

**An earlier draft of this ADR answered a harder version of this question**, for
a Tauri client whose WKWebView would not keep a cross-site cookie at all. Its
answer was a bearer token in the device store, a relay for the two cookies the
token plugin does not carry, and a token in the WebSocket address because an
upgrade cannot set a header. All of it worked. None of it is needed now, and the
reason is the whole of this decision.

## Decision

**Somebody signs in to the desktop client through their own browser, and the
session it gets back is attached to every request by the main process.**

### Signing in happens where signing in works

`@better-auth/electron` is the library's own answer and Flux takes it whole. The
window opens the system browser at the server's own sign-in page. Somebody signs
in there — with a saved password, a passkey, an authenticator app, whatever they
use — and none of that is Flux's concern, because in a browser on the server's own
origin it all already works. The page hands back a single-use authorization code
over a registered `app.flux.desktop:` deep link, and the main process exchanges it
for a session.

**The window never holds the session.** It lives in the main process, in the
storage the plugin manages, and the page reaches it through bridges that expose
`requestAuth`, `getUser` and `signOut` and nothing else. A page that is
compromised cannot read a credential it was never given.

**Two-factor needs nothing.** The pending challenge is a signed cookie, and the
challenge happens in a browser, which holds cookies. The same is true of the
trusted-device record, and of any cookie a future better-auth plugin sets. That is
the property worth having: this decision does not enumerate cookies, so it cannot
fall behind them.

### The session is attached where a page cannot reach

The plugin authenticates its own requests and knows nothing about the rest of
Flux. Libraries, artwork, subtitles and every media segment are Flux's own
endpoints, and the `<video>` element's requests cannot be given a header by any
script.

So the main process attaches the session to requests on their way out, through
`onBeforeSendHeaders`. That is the one place that sees all of them — `fetch`,
`<video>`, shaka, and the WebSocket upgrade alike — and it is available because
the process that owns the window is not itself a page.

**Only to the server somebody named.** `cookieForRequest` compares origins and
answers nothing for anything else, because a credential sent to a host that did
not ask for it is a credential given away. An artwork request to a metadata
provider leaves bare.

### The browser is unchanged

It signs somebody in where they already are, sends the cookie it already has, and
answers `null` to the `signInElsewhere` port. Nothing about the web application
learns that a second kind of client exists.

## Consequences

### What this gets us

**Nothing to keep in step.** No token, no cookie relay, no query string on a
socket, no list of which cookies matter. The library's flow is the flow.

**A credential the application cannot read**, which is strictly better than the
bearer token this replaces. That token sat in a device store precisely because
there was nowhere better; this one is in another process.

**Everything a browser can do at sign-in, for free.** Passkeys, two-factor,
password managers, SSO. All of it happens in a real browser, so all of it works
without Flux having a position on any of it.

**One place that signs a request.** Where the token approach had to be applied at
every chokepoint and could be missed by any new call site, this is applied once,
below all of them.

### What this costs us

**Sign-in leaves the application.** A window that opens a browser is a worse moment
than a window that asks for a password, and it is the one part of this that is
plainly a downgrade in feel. Somebody can close the tab, and the window then waits
for something that will not arrive — which is why the screen waits for the account
rather than for the browser to open, and offers a way back.

**A deep link, which is an operating system's business.** Registering
`app.flux.desktop:` works on macOS and Windows; on some Linux desktops it is
unreliable, and better-auth documents a manual code fallback for exactly that.
Flux does not implement the fallback yet.

**A protocol scheme is now part of the deployment.** `app.flux.desktop:/` is a
trusted origin on every server, allowed without configuration. That is safe
because nothing on the internet can navigate to it, but it is a name the server
now knows.

**The main process is on the credential path.** A bug in `cookieForRequest` sends
a session somewhere it should not go. It is nine lines with ten tests, including
the case of a host that merely starts the same way, and that is deliberate.

### What this forecloses

Signing in inside the desktop window. The wall of faces is a browser screen now,
for desktop users, and picking a profile happens there.

A desktop client on an engine with no main process to attach headers from. This
decision leans on that, where the token approach did not.

## Alternatives considered

**A bearer token in the device store.** What the earlier draft of this ADR chose,
and what was built and then removed. `bearer()` carries the session cookie and no
other, so the two-factor cookies needed a relay of their own on both sides, and a
WebSocket upgrade needed the token in its address. Four moving parts standing in
for one cookie, each of which has to go on being right as better-auth grows
plugins that set cookies — and one that does would fail silently on desktop and
nowhere else. It also put a readable credential in storage, which this does not.

**`SameSite=None; Secure` cookies and CORS.** Would work in Electron's Chromium,
which has no tracking prevention, and weakens the browser's cookie to buy the
desktop something the deep-link flow gives it for nothing.

**better-auth's `jwt` plugin.** Solves verification by somebody other than the
issuer. Flux's server is the only thing that verifies a Flux session.

**API keys, which Flux already has.** They identify an integration rather than a
person, are minted deliberately by an operator, and carry no session, so none of
the two-factor, passkey or profile machinery would apply.

**Serving the desktop application from the server** so that it shares an origin.
Discards the offline case, makes the client useless when the server is
unreachable, and is most of the way back to a browser.

## Revisit when

A Linux desktop environment somebody actually uses cannot complete the deep link,
at which point the manual code fallback stops being optional.

better-auth's Electron integration gains a way to sign in without leaving the
application, which would remove the one real cost above.

Flux gains a client with no main process — a television, a console — where neither
this nor the token approach applies unchanged, and the question is open again
rather than answered by either.
