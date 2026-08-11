# ADR-0015: Cast by handing devices an address, and load Google's sender to do it

- **Status:** Accepted
- **Date:** 2026-08-11
- **Deciders:** Marques Scripps
- **Supersedes:** —
- **Superseded by:** —

## Context

Playing on a television in the same house is a thing people expect of a media
server, and there are three ways to offer it.

The web platform has two: Safari's AirPlay picker, and the standard Remote
Playback interface. Both work the same way — the browser hands a receiver an
address and the receiver fetches the stream itself — and both refuse to tell a
page what devices exist, since a list of them is a fingerprint. Neither needs
anything fetched from anybody.

Measured rather than assumed, on a network advertising a Chromecast, a Nest Hub
and an AirServer instance over mDNS: desktop Chrome reports **no devices
available** through the standard interface, for our streams and for an ordinary
remote MP4 alike, and `prompt()` closes immediately. The interface exists there
and finds nothing. Safari's AirPlay picker works.

Casting to a Chromecast is a conversation in Google's own protocol, and the
library that speaks it is served from `gstatic.com` and is not distributable.
Flux has otherwise avoided fetching anything from a third party at runtime —
fonts are self-hosted specifically so that a self-hosted server tells nobody
who is looking at it.

A third route exists: the server could discover receivers itself over mDNS and
drive them over Cast or DLNA. It is much the largest, and it duplicates what a
browser already does well.

## Decision

Cast by handing the receiver an address. Flux never sends pixels.

Use whichever mechanism the browser has, in this order:

1. **Google's sender library**, fetched from `gstatic.com` when a player is
   opened and not before, where it can be had. This is the only third-party
   runtime dependency Flux has, and it exists solely because Chrome cannot
   otherwise cast to a Chromecast at all.
2. **The browser's own picker** — AirPlay in Safari, Remote Playback elsewhere
   — where the library is absent or blocked.

Stream addresses given to a receiver are built from the address the viewer is
reading the page at. Playback sessions are already served by session identifier
rather than by cookie, so a television can fetch them without credentials.

The device list always belongs to the browser or to Google's library. Flux does
not draw one, because neither mechanism will say what is on the network.

Use Google's default receiver (`CC1AD845`). A receiver of our own is a separate
decision, and a separate ADR.

## Consequences

### What this gets us

- Casting works in the two browsers most people have, to the receivers most
  people own, with no server-side discovery to write or maintain.
- A television plays the stream directly from the server. The machine doing the
  browsing is not in the path, so closing the laptop does not stop the film.
- Nothing is fetched from anybody until somebody opens a player, and nothing at
  all for viewers who never cast.

### What this costs us

- One request to `gstatic.com` per player, which is one more thing a
  self-hosted instance tells the outside world. It is conditional and late, but
  it is real, and it is a deviation from how fonts are handled.
- A content security policy must allow that script, and the frame the library
  creates, wherever one is set.
- Two mechanisms means two behaviours: Chrome shows Google's picker, Safari
  shows the system's, and what a viewer sees depends on their browser.
- Casting requires a secure connection in Chrome and an address other machines
  can reach, which are conditions a home setup does not meet by accident. TLS in
  development exists for this reason.

### What this forecloses

- Nothing about a receiver of our own: that decision stays open, and the default
  receiver can be swapped for an application id without changing the shape of
  any of this.
- Server-side discovery stays possible, and is the answer if casting is ever
  wanted with no browser open at all — but it is now the second implementation
  rather than the first.
