# ADR-0025: The desktop client is Electron, chosen on what it can hold rather than what it can decode

- **Status:** Proposed
- **Date:** 2026-08-20
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

[FLUX-8](https://linear.app/flux-streaming/issue/FLUX-8/featclient-desktop-application)
exists to settle what a desktop client is built on, and asks for an ADR rather
than a preference. It names the codec question as the thing to settle first: "if
a bundled player is needed either way, Electron's main advantage disappears."

Its argument for building a client at all is not that the client should
re-encode. It is that the client should play more of what the server already
holds, so that nothing is encoded on either machine — "declare a wider, honestly
measured `DeviceProfile` so `negotiatePlayback` picks direct play more often."

**Most of that turned out to be achievable without a client.** Four values in
`detectDeviceProfile` were numbers Flux had decided on a browser's behalf and
then reported as capability. Removing them, over FLUX-145, FLUX-148, FLUX-152 and
FLUX-153, moved the web application most of the way to the profile this ticket
wanted a desktop client for:

- a twenty megabit ceiling nobody measured, so every larger file was re-encoded;
- `maxAudioChannels: 2`, so every multichannel track was downmixed;
- a channel count used as a reason to encode rather than a target to encode
  toward, which on a Mac with AirPods meant refusing 5.1 on the strength of a
  stereo endpoint that renders spatial audio itself;
- three codec probes asking about WebM while the profile claimed MP4.

The result is that Safari today direct plays multichannel E-AC-3, and macOS
spatialises it. That is the greater part of what FLUX-8 promised, delivered in
the browser.

So the client's case is narrower than the ticket assumed. What remains out of the
browser's reach is Dolby on Chromium, Atmos objects anywhere, and the system
integration — downloads, media keys, a tray, Rich Presence — that is not a codec
question at all.

### This ADR was first drafted the other way

An earlier draft chose Tauri, on the measurement below, and was never accepted.
Building on it is what changed the answer, and the reason is worth stating plainly
rather than quietly rewriting: **the codec question was answered before anybody had
asked what a desktop window can hold.**

A Tauri window is WKWebView, and WKWebView will not send a cookie to a server whose
pages it did not serve. Intelligent Tracking Prevention does not relax for a custom
scheme, and no server configuration reaches it — so a session had to be carried
some other way, and every piece of that was Flux's to invent.

Electron's Chromium has no such objection, and its main process can reach what a
page cannot. That is what makes
[ADR-0026](0026-the-desktop-client-is-a-window-onto-the-server.md) possible: the
window loads the server's own pages, and every question about holding a session
stops being asked. On WKWebView that is not available — a Tauri window cannot be
pointed at a remote origin and keep its cookies — so the framework choice and the
architecture are the same choice.

## Decision

**The desktop client is Electron**, chosen on authentication rather than on
codecs.

**No bundled libmpv.** FLUX-8 assumes a build ships one for codec breadth. mpv has
no spatial audio on Apple platforms —
[mpv#9252](https://github.com/mpv-player/mpv/issues/9252) was closed without
resolution and would need `AVSampleBufferAudioRenderer` — so bundling it to widen
video would narrow audio on the platform where the audio is the point.

**Mainline Electron for now, not a fork.** See "Revisit when" and FLUX-164.

**What goes in the window is the server's, not ours.** See
[ADR-0026](0026-the-desktop-client-is-a-window-onto-the-server.md).

### What was measured, and still holds

macOS 26.4.1, the same probe run in WKWebView through a Swift harness and in
Chrome, asking `HTMLMediaElement.canPlayType` and `MediaSource.isTypeSupported`:

| codec       | WKWebView             | Chrome        |
| ----------- | --------------------- | ------------- |
| `mp4a.40.2` | probably, MSE yes     | probably, yes |
| `ac-3`      | **probably, MSE yes** | **no**        |
| `ec-3`      | **probably, MSE yes** | **no**        |
| `ac-4`      | no                    | no            |
| `dtsc`      | no                    | no            |
| `mlpa`      | no                    | no            |

Chromium ships AC-3 and E-AC-3 behind `enable_platform_ac3_eac3_audio`, off by
default; the request to enable it in Electron
([electron#48819](https://github.com/electron/electron/issues/48819), November 2025) has no maintainer response.

This measurement is not disputed and it is not obsolete. It has been demoted: it
is now a cost this decision pays rather than the figure it turns on.

### Two features share the name "spatial audio"

The first is spatialised PCM: the operating system takes decoded stereo or
multichannel and renders it to AirPods with head tracking. Any application
producing multichannel PCM gets it, and Flux gets it today through Safari — and
will get it in Electron, which produces PCM like anything else.

The second is Dolby Atmos proper, where the E-AC-3 bitstream carrying its object
metadata reaches Apple's renderer, or a receiver, **undecoded**. An application
that decodes to PCM first has discarded the objects; what comes out is a downmix
wearing the name.

Electron forecloses the second on the desktop until it can decode E-AC-3 at all.
It does not touch the first.

## Consequences

### What this gets us

**Authentication stops being anybody's problem.** The window loads the server's own
pages, so a cookie is a cookie and a saved password, a passkey and an authenticator
app all work as they always have — see
[ADR-0026](0026-the-desktop-client-is-a-window-onto-the-server.md). The Tauri
answer put a readable credential in a device store because there was no
alternative. This one holds no credential at all.

**One engine to test against.** A Tauri window is whatever WKWebView the operating
system happens to ship, so a Mac on an older release draws differently from Chrome
and there is nothing to pin. Electron ships its own Chromium, which is more bytes
and a known quantity.

**The screens are reused whole**, which is what ADR-0022 and ADR-0023 were for. A
client is an entry point, the platform ports of ADR-0022, a preload script, and a
stylesheet.

**A window that can be pointed somewhere.** Electron will load a remote origin into
a `BrowserWindow` and treat it as that origin, cookies and passkeys and all, with a
preload script still attached for the native parts. That single capability is the
whole of ADR-0026, and it is what Tauri does not offer.

### What this costs us

**Dolby transcodes on the desktop client.** The measurement above, paid. This is
not a regression against the web application — Chrome viewers are already here —
but it is the specific thing FLUX-8 wanted a desktop client for on a Mac, and a
Safari viewer moving to the desktop client loses direct play of E-AC-3. That is
the sharpest edge of this decision and it should not be softened.

**A much larger client.** Chromium and Node, against a Tauri binary that borrows
the system WebView.

**A weaker case than the ticket assumed.** Most of the codec win landed in the
browser. What is left for the desktop client is the system integration and
offline — worth building, but this ADR should not be read as promising a fidelity
jump for somebody already watching in Safari. On a Mac it is currently a fidelity
step backwards for Dolby.

**A profile that belongs to the output device.** Audio capability changes mid-film
when somebody plugs in headphones or connects a receiver, and `DeviceProfile` is
negotiated per session. FLUX-152 removed the sharpest edge of this by making the
channel count a target rather than a gate; a client that ever passes an Atmos
bitstream through will have to care where the browser did not.

**A zod 4 migration nobody asked for.** Reaching `@better-auth/electron` at all
meant better-auth 1.7, which meant one zod in the tree, which meant `@hono/zod-openapi`
1.6 across the API contract layer. The package was later removed and the migration
kept: it was owed anyway, and the tree is on the version the ecosystem is on. It is
recorded here because the cost was paid for a package that is gone.

### What this forecloses

Dolby passthrough on the desktop, until Electron can decode it or Flux ships a
build that can. FLUX-164 is that path and it is not speculative — castLabs already
toggle the flag.

WKWebView, and with it the system integration that only a native shell has. Nobody
was asking for that.

## Alternatives considered

**Tauri.** What this ADR first chose. Decodes Dolby on macOS, which Electron does
not, and has no answer at all for holding a session — every part of that would go
on being Flux's to write, test and get right, on the path where being wrong is
worst. The codec advantage is real and recoverable elsewhere; the authentication
disadvantage is structural.

**Tauri with the machinery already built.** It existed and it worked: a bearer
token, a two-factor cookie relay proved end to end against real better-auth, a
token on the socket upgrade. Rejected because working is not the bar for the code
that decides who somebody is, and because ADR-0026 removed the need for any of it
by removing the condition that produced it.

**Fully native SwiftUI.** The only option where spatialisation is a first-class
API (`AVPlayerItem.allowedAudioSpatializationFormats`), and it discards
`packages/screens` entirely, which is the half of the application that took two
refactors to make portable. Rejected as a whole-client strategy.

**Bundling libmpv.** Buys video codec breadth and costs spatial audio.

**Building no desktop client.** Genuinely stronger than it was a week ago, and the
reason this ADR states the narrowed case plainly rather than restating the
ticket's. It loses offline downloads, media keys, a tray and Rich Presence, which
a browser cannot have — so it is rejected, but on those grounds now rather than on
codecs.

## Revisit when

**A build of Electron decodes E-AC-3.** castLabs already ship one:
`v43.0.0-alpha.1+wvcus` toggles `enable_platform_ac3_eac3_audio`, and their builds
carry Widevine besides. FLUX-164 holds what has to be checked first — whether a
stable release carries the flag, and the fact that on Linux it reports the codec
supported and then plays silence, which is worse than not supporting it because
`negotiatePlayback` believes what the client says.

Electron enables it upstream, which
[electron#48819](https://github.com/electron/electron/issues/48819) asks for.

**A native playback layer turns out to be needed.** `attachShaka` is the only
module importing `shaka-player`, so the seam exists.

**Tauri gains an authentication story.** This decision turned on that and nothing
else; if it changes, the codec measurement above becomes decisive again and points
the other way.
