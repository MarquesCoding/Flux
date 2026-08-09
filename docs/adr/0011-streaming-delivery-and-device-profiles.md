# ADR-0011: Streaming delivery and device profile negotiation

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Given a media file and a client, something must decide: play it untouched,
change the container, re-encode the audio, re-encode the video, burn in
subtitles, or some combination. This decision is the single largest source of
user-visible behaviour in a media server, and the single largest source of
support load.

Jellyfin models this with a `DeviceProfile` containing `DirectPlayProfiles` and
`TranscodingProfiles`, and selects among four modes:

| Mode          | What changes                | Server cost |
| ------------- | --------------------------- | ----------- |
| Direct Play   | Nothing                     | Near zero   |
| Remux         | Container only              | Low         |
| Direct Stream | Audio only, video untouched | Moderate    |
| Transcode     | Video re-encoded            | High        |

The model is sound. Its practical problems are that profiles are opaque to
users, hard to author, effectively untestable, and — most importantly — when the
server makes a decision the user disagrees with, **there is no way to find out
why.** "Why is this transcoding?" is one of the most common questions in the
Jellyfin community, and answering it currently means reading server logs and
inferring.

## Decision

### Playback modes

Adopt the same four modes and the same preference order: Direct Play, then
Remux, then Direct Stream, then Transcode. Always select the cheapest mode the
client can actually handle.

### Device profiles are declarative, versioned, and schema-validated

A profile is a JSON document validated against a published JSON Schema, living
in `packages/contracts` alongside everything else. Profiles are:

- **Versioned**, with a schema version field, so old profiles keep working
- **Layered**: built-in profiles ship with the server, plugins may contribute
  profiles via `TranscodeProfileProvider`, and administrators may override at
  the device or user level. Resolution order is explicit and inspectable.
- **Client-declarable**: a client may submit its own capability document rather
  than relying on server-side identification by user-agent, which is guesswork.

### The negotiator produces a plan, not a mode

The output of negotiation is a `PlaybackPlan` with **independent decisions per
axis**:

```
PlaybackPlan {
  container: Passthrough | Remux(target)
  video:     Passthrough | Transcode(codec, profile, level, bitrate, hdr)
  audio:     Passthrough | Transcode(codec, channels, bitrate)
  subtitles: Passthrough | Sidecar(format) | BurnIn
  reasons:   Reason[]   // one per axis, always populated
}
```

This structure is what enforces ADR-0010's rule that a video-range mismatch may
never cause an audio re-encode. The axes cannot be coupled by accident because
they are computed separately; coupling would have to be written deliberately.

The four named modes become _labels derived from the plan_ for display purposes,
not the thing being computed.

### Every decision is explained

`reasons` is mandatory, not optional, and it is exposed in three places:

1. **The playback UI**, on request — "Transcoding video: your browser does not
   support HEVC. Audio and subtitles are being passed through."
2. **The admin session view**, in full, with the resolved FFmpeg command from
   ADR-0009.
3. **A dry-run API endpoint** — `POST /api/playback/explain` accepting a media
   id and a device profile, returning the plan and reasons **without starting a
   session.**

That third one is the important one. It makes profile authoring testable, gives
plugin developers a way to verify their profiles, gives users a self-service
answer to "why is this transcoding?", and gives us a way to write regression
tests over negotiation as pure data, with no media and no FFmpeg involved.

### Delivery

- **HLS with fMP4 segments** as the primary adaptive format; **DASH** where the
  client prefers it. Both are packaged by the Rust service (ADR-0009).
- **Direct play and remux use plain HTTP byte-range requests**, served by Rust.
  No segmentation overhead for the cheapest and most common path.
- **Segment-level transcoding with a look-ahead window**, so that seeking to an
  unbuffered position does not restart the whole session. Segments are content-
  addressed by (media id, plan hash, segment index) so a seek backwards into
  already-transcoded territory is a cache hit.
- **The plan hash is part of the segment cache key.** Two clients with different
  plans never share segments, which removes an entire class of subtle corruption.
- **Trickplay images** (seek-bar thumbnails) generated as a background job.

### Session lifecycle

Sessions are reference-counted and torn down promptly on client disconnect.
Orphaned FFmpeg processes surviving a closed browser tab are a well-known
resource leak in this software category; the supervisor in ADR-0009 reaps them
on a timer as a backstop, not only on the disconnect event.

## Consequences

### What this gets us

The explainer endpoint is a genuine differentiator that costs very little once
negotiation returns structured reasons — the information already exists, it is
merely thrown away today. Negotiation becomes unit-testable as pure functions
over data, which means a test corpus of (media, profile) pairs can pin behaviour
in CI. Independent axes eliminate a documented Jellyfin bug class by
construction.

### What this costs us

Content-addressed segment caching with plan hashes uses more disk than a single
per-session directory, since near-identical plans do not share. The
`/transcodes` ceiling and LRU eviction from ADR-0006 make this bounded rather
than dangerous.

Maintaining reasons through every branch of the negotiator is discipline that
will decay unless enforced — the plan type should make `reasons` non-optional at
the type level so an unexplained decision does not compile.

Look-ahead transcoding does speculative work that a user who never seeks will
throw away, costing CPU on a machine where CPU is the scarce resource. The
window must be configurable and modest by default.

### What this forecloses

Little. The main constraint is that negotiation must stay a pure function of
(media metadata, device profile, server capabilities, user settings). Anything
that makes it depend on live server state — current load, time of day — breaks
the dry-run explainer, which is the feature most worth protecting here.

## Alternatives considered

**Copy Jellyfin's `DeviceProfile` verbatim for compatibility.** Tempting for
client reuse, and worth offering as an _import path_ so existing custom profiles
migrate. Rejected as the native format: it carries DLNA-era assumptions and has
no room for the per-axis reasons this ADR is built around.

**Client-side decision making.** Let the client fetch metadata and request a
specific treatment. Rejected as the primary model — it puts the compatibility
matrix in every client and makes fixing a bug an N-client release. Retained as
an override for advanced clients that know better.

**Always transcode to a single safe format.** Trivially correct, wastes enormous
CPU, and degrades quality for clients that could direct play. Rejected.

**Per-title encoding ladders.** Deferred, not rejected. Genuinely better quality
per bit, but requires analysis passes that are expensive on homelab hardware.
Revisit once the basic pipeline is solid.

## Revisit when

- Real-world profile data shows the schema is missing an axis.
- The explainer endpoint's reason vocabulary proves too coarse to be useful.
- Segment cache hit rates suggest the plan-hash key is too strict.

## Sources

- [Transcoding | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/)
- [Codec Support | Jellyfin](https://jellyfin.org/docs/general/clients/codec-support/)
- [DeviceProfile | @jellyfin/sdk](https://typescript-sdk.jellyfin.org/interfaces/generated-client.DeviceProfile.html)
- [StreamBuilder.cs — jellyfin/jellyfin](https://github.com/jellyfin/jellyfin/blob/master/MediaBrowser.Model/Dlna/StreamBuilder.cs)
- [DLNA and Stream Selection — jellyfin/jellyfin | DeepWiki](https://deepwiki.com/jellyfin/jellyfin/3.3-dlna-and-stream-selection)
- [Device Profiles & Identification — jellyfin-plugin-dlna | DeepWiki](https://deepwiki.com/jellyfin/jellyfin-plugin-dlna/7.1-device-profiles-and-identification)
