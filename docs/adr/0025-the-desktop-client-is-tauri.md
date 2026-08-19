# ADR-0025: The desktop client is Tauri, chosen on what each engine can decode

- **Status:** Proposed
- **Date:** 2026-08-19
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

So the client's case is narrower than the ticket assumed, and more precise. What
remains genuinely out of the browser's reach is Chromium's inability to decode
Dolby at all, Dolby Atmos objects anywhere, and the system integration —
downloads, media keys, a tray, Rich Presence — that is not a codec question.

### Two features share the name "spatial audio"

The first is spatialised PCM: the operating system takes decoded stereo or
multichannel and renders it to AirPods with head tracking. Any application
producing multichannel PCM gets it, and Flux gets it today through Safari.

The second is Dolby Atmos proper, where the E-AC-3 bitstream carrying its object
metadata reaches Apple's renderer, or a receiver, **undecoded**. An application
that decodes to PCM first has discarded the objects; what comes out is a downmix
wearing the name.

Only the second constrains the framework, and it asks one question: can an
encoded Dolby bitstream reach AVFoundation without the application decoding it on
the way?

## Decision

**The desktop client is Tauri rather than Electron**, chosen on measurement.

**No bundled libmpv.** FLUX-8 assumes a Tauri build ships one for codec breadth.
mpv has no spatial audio on Apple platforms —
[mpv#9252](https://github.com/mpv-player/mpv/issues/9252) was closed without
resolution and would need `AVSampleBufferAudioRenderer` — so bundling it to widen
video would narrow audio on the platform where the audio is the point.

**Whether the Mac build needs a native playback layer is left open.** See
"Revisit when". `attachShaka` is the only module importing `shaka-player`, so the
seam for one exists if it turns out to be needed.

### What was measured

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
([electron#48819](https://github.com/electron/electron/issues/48819), November 2025) has no maintainer response. An Electron client would have to build Chromium
from source on every release, and take on Dolby licensing deliberately, to reach
where WKWebView already is.

That asymmetry is now the **only** browser limitation left in the audio path,
which is what makes it decisive rather than merely interesting. Building on
Electron would ship the one restriction the profile work removed everywhere else.

**What this does not show.** Whether WKWebView hands the E-AC-3 bitstream to
AVFoundation intact or decodes it to PCM in process. That is the difference
between Atmos and a spatialised downmix, it is not observable from JavaScript,
and this decision claims nothing either way.

## Consequences

### What this gets us

The screens are reused whole, which is what ADR-0022 and ADR-0023 were for. A Mac
client is an entry point, the platform ports of ADR-0022, and a stylesheet.

Chromium viewers stop being the ones who cannot have Dolby, which after the
profile work is the last group who cannot.

The framework is chosen on a figure rather than on taste, which is what FLUX-8
asked for.

### What this costs us

**The WebView is the operating system's.** Its version is macOS's, so a Mac on an
older release draws differently from Chrome and there is no single engine to test
against. FLUX-8 already named this cost for Tauri and it does not go away.

**A weaker case than the ticket assumed.** Most of the codec win landed in the
browser. What is left for the desktop client is Chromium parity, Atmos, and the
system integration — worth building, but this ADR should not be read as
promising a large fidelity jump for somebody already watching in Safari.

**A profile that belongs to the output device.** Audio capability changes mid-film
when somebody plugs in headphones or connects a receiver, and `DeviceProfile` is
negotiated per session. FLUX-152 removed the sharpest edge of this by making the
channel count a target rather than a gate, but a client that wants to pass an
Atmos bitstream through will have to care where the browser did not.

### What this forecloses

Electron for this platform, on the measurement above and narrowly. An Electron
client would work — it would simply transcode Dolby forever, which is the one
restriction left worth removing.

A single playback implementation across clients, if the native layer turns out to
be needed. Windows and Linux would each then want their own answer.

## Alternatives considered

**Electron.** Decodes neither AC-3 nor E-AC-3 as shipped. Not broken — parity
with today's web app plus the system integration — but parity is not the reason
to build it, and it would newly cap what Safari viewers already have.

**Fully native SwiftUI.** The only option where spatialisation is a first-class
API (`AVPlayerItem.allowedAudioSpatializationFormats`), and it discards
`packages/screens` entirely, which is the half of the application that took two
refactors to make portable. Rejected as a whole-client strategy; not rejected as
a playback layer, which is the open question below.

**Bundling libmpv.** Buys video codec breadth and costs spatial audio.

**Building no desktop client.** Genuinely stronger than it was a week ago, and
the reason this ADR states the narrowed case plainly rather than restating the
ticket's. It loses offline downloads, media keys, a tray and Rich Presence, which
a browser cannot have — so it is rejected, but on those grounds now rather than
on codecs.

## Revisit when

**WKWebView is measured against a real Atmos stream on multichannel output.** If
the bitstream survives to AVFoundation, this decision is complete as written. If
it is decoded to PCM in process, the Mac build needs a native playback layer
behind the `attachShaka` seam, and that is a second ADR rather than an amendment
to this one.

Chromium enables `enable_platform_ac3_eac3_audio` by default, or Electron ships
it, which would remove the asymmetry this decision rests on and leave the choice
resting on stack fit alone.

Windows or Linux gets a client, at which point whether each platform grows its
own player or all three share one becomes a real question.
