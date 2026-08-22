# ADR-0017: HDR metadata is written rather than downloaded

- **Status:** Accepted
- **Date:** 2026-08-17
- **Deciders:** Daniel Morgan
- **Supersedes:** The Tier 2 half of [ADR-0012](0012-media-test-corpus-external-fixtures.md)
- **Superseded by:** —

## Context

[ADR-0012](0012-media-test-corpus-external-fixtures.md) put HDR10+ and Dolby
Vision in Tier 2: a multi-gigabyte download, run nightly and pre-release rather
than per pull request. It said so for a good reason, stated plainly in its own
alternatives section — "real-world Dolby Vision RPUs, HDR10+ dynamic metadata …
cannot be synthesised faithfully".

That was true of FFmpeg and is not true of the ecosystem around it. `dovi_tool`
builds a valid RPU from a JSON description, and `hdr10plus_tool` writes SMPTE
2094-40 metadata the same way. Both are MIT, both publish prebuilt binaries, and
neither needs a frame of anybody's film: the metadata is _described_ rather than
measured.

The cost of the old plan was not only bandwidth. Every candidate for a Tier 2
download is commercial content — the formats exist to carry films — so the tier
could not have been redistributed, which [ADR-0016](0016-fixture-provenance-decides-how-it-is-verified.md)
already concluded about the smaller Tier 1 files. A tier nobody may serve is a
tier that exists on one machine.

What actually blocks synthesis is muxing, not metadata. A Dolby Vision RPU
travels in `unspec62` NAL units: FFmpeg's MP4 muxer drops them silently and its
Matroska muxer refuses the packets outright. mkvmerge carries them, which is why
every Dolby Vision file in the wild is a Matroska.

## Decision

**Tier 2 is synthesised, not downloaded.** An HDR10 base stream is encoded by
FFmpeg, the dynamic metadata is written onto it from a description held in this
repository, and mkvmerge muxes the result.

- **Dolby Vision is profile 8.1**, whose base layer is ordinary HDR10. That is
  the profile worth having: it carries a configuration record on the stream _and_
  an RPU on every frame, which is the combination a negotiator has to tell apart,
  and a player that cannot read the RPU still shows a picture.
- **The metadata values are invented and say so.** They describe a plausible tone
  curve. Nothing is extracted from any real file, so no question of licence
  arises for the corpus at any tier.
- **Tier 2 remains opt-in**, but for a different reason than ADR-0012 gave. Not
  size — the two fixtures are 660 KB each and build in seconds — but that they
  need three tools beyond FFmpeg. Absent tools skip loudly and never fail.
- **mkvmerge is a required tool for Tier 2**, from MKVToolNix, alongside the two
  metadata writers which the sync fetches itself.

Real HDR files an operator already owns are still worth reading, and the local
tier does that where it sits and never copies or redistributes it.

## Consequences

### What this gets us

The support matrix covers every HDR system Valence claims, on every machine, in
seconds and with no download. `VideoRange::Hdr10Plus` in particular now has a
file that exercises it — it was unreachable in production for as long as it has
existed, and the test that covered it passed throughout because it put the
metadata where ffprobe never puts it. Blinding the probe to frame side data now
fails that test and only that test.

Nothing in the corpus is material we may not serve.

### What this costs us

Three more tools, and a version of each to keep current. mkvmerge is a system
package rather than something the sync can fetch, so a machine without it builds
a corpus with a hole in it — announced, but a hole.

Synthetic metadata is well formed rather than realistic. It will not reproduce a
grading house's curve, a broken RPU, or the quirks of a particular authoring
tool. Those still need a real file.

### What this forecloses

Any claim that the corpus proves Valence handles _real_ Dolby Vision, as opposed to
valid Dolby Vision. Profiles 5 and 7 are also untouched — 8.1 is the one built —
and dual-layer profile 7 in particular is a different shape that this approach
has not been tried against.

## Alternatives considered

**Keep Tier 2 as a download, per ADR-0012.** Multi-gigabyte, per-machine, and
made of material we could not redistribute even if we hosted it.

**Rely on the local tier alone.** Works only for an operator who owns a Dolby
Vision file, which is nobody in CI and nobody on a fresh clone.

**Extract an RPU from a real file and reuse it.** Cheaper than generating one and
puts metadata derived from commercial content into the repository, which is the
thing being avoided.

**Mux with FFmpeg.** Tried first. Its MP4 muxer drops the RPU without a word and
its Matroska muxer errors after one frame.

## Revisit when

- Profile 5 or 7 coverage is wanted, which needs more than the generator config
  used here.
- FFmpeg's muxers learn to carry an RPU, which would remove the mkvmerge
  dependency.
- A freely licensed real-world HDR set appears, which would be worth having
  _alongside_ this rather than instead of it.
