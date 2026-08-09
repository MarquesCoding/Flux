# ADR-0012: Media test corpus as external fixture download

- **Status:** Accepted
- **Date:** 2026-08-09
- **Relates to:** ADR-0010, ADR-0011

## Context

ADR-0010 commits to a large, combinatorial support matrix — codecs, containers,
subtitle formats, HDR variants, audio channel layouts — and states that without a
test corpus exercised in CI, "supported" is an assertion rather than a fact.

The corpus cannot live in the repository. Real media samples covering that matrix
run to multiple gigabytes. Git stores binaries badly: every revision of a sample
is retained forever, so a corpus that churns would make cloning the repository
progressively more painful for every contributor, including the majority who
never touch the media pipeline.

There is also a licensing constraint that is easy to miss. Test media must be
freely redistributable. Clips taken from commercial films — the obvious source
for real-world HDR and Dolby Vision edge cases — are not, regardless of length or
intent. A corpus we cannot legally distribute is a corpus we cannot use in
public CI.

## Decision

**The media test corpus is an external, versioned fixture bundle, fetched on
demand.** It is never committed to the repository.

### Three tiers

**Tier 0 — Generated, no download.**
The large majority of matrix coverage is produced deterministically by FFmpeg at
fixture-build time from synthetic sources (`testsrc2`, `sine`, generated subtitle
tracks), muxed into every container and codec combination we claim to support.
This is the default tier: it runs in every CI job and on every contributor
machine, costs no bandwidth, has no licensing question at all, and is byte-for-
byte reproducible given a pinned FFmpeg build.

Any format combination that _can_ be generated, _is_ generated. Downloading is
reserved for what genuinely cannot be.

**Tier 1 — Small curated download (~500 MB target).**
Real-world files exercising muxer quirks, unusual metadata, and encoder
idiosyncrasies that synthetic generation does not reproduce. Sourced exclusively
from freely licensed material — Blender Foundation open movies (CC-BY), FFmpeg
FATE samples, and clips we encode ourselves from those sources. Runs on every
pull request that touches `apps/transcoder` or the negotiator.

**Tier 2 — Full HDR and Dolby Vision set (multi-GB).**
HDR10, HDR10+, and Dolby Vision profile 5/7/8 samples, high bitrate 4K, and
lossless audio including Atmos. Nightly and pre-release only, not per-PR.

### Mechanics

- A `fixtures.manifest.json` in the repository lists every fixture with its
  **SHA-256, size, tier, licence, and source URL.** The manifest is the
  committed artifact; the bytes are not. It is reviewable in diffs, so adding a
  fixture is a visible, auditable change.
- `pnpm fixtures:sync [--tier N]` downloads, verifies checksums, and caches
  outside the working tree. A checksum mismatch is a hard failure, never a
  warning.
- Fixtures are hosted as **GitHub release assets on a dedicated
  `media-fixtures` repository**, versioned independently. This avoids paying for
  a CDN, gives us stable URLs, and keeps fixture history out of the main repo's
  history.
- CI caches the bundle keyed by manifest hash, so the download happens on
  manifest change rather than on every run.
- **Tests requiring an absent tier skip with an explicit, actionable message**
  naming the command to fetch it — never fail, and never silently pass. A
  contributor working offline or on the web client must be able to run the test
  suite without a multi-gigabyte download, and must not be able to mistake
  "skipped" for "passed". CI asserts that the expected tiers were actually
  present for the job, so a misconfigured pipeline cannot quietly skip the
  entire media suite.

### Licensing rule

**Every fixture records its licence in the manifest, and only freely
redistributable material is accepted.** Contributors may not add clips from
commercial media, and pull requests adding fixtures without a licence field are
rejected. This is a contribution rule as much as a technical one and belongs in
the contributing guide.

## Consequences

### What this gets us

Cloning stays fast for everyone. The corpus can grow to whatever size correctness
demands without any repository cost. Tier 0 means most media-pipeline work needs
no download at all, which keeps the contribution barrier low for the component
with the highest barrier already. Checksums in a reviewed manifest make the
corpus tamper-evident.

### What this costs us

A second repository and release process to maintain. A contributor touching HDR
handling faces a real download before they can test, which is friction on
precisely the hardest and most valuable work. Fixture URLs can rot; the checksum
manifest detects corruption but not disappearance, so we should mirror Tier 1
into our own release assets rather than hotlinking upstream.

Tier 0 generation depends on the pinned FFmpeg build from ADR-0009. An FFmpeg
upgrade may change generated output, which will surface as fixture churn — this
is a feature (it tells us encoder behaviour changed) but it will occasionally be
noisy.

### What this forecloses

Fully offline first-run testing of the media pipeline beyond Tier 0, and any
test that would require commercially licensed source material.

## Alternatives considered

**Git LFS.** The conventional answer. Rejected: it still couples corpus size to
the main repository, LFS bandwidth on hosted plans is metered and easy to
exhaust, and it imposes an LFS install on every contributor including those who
will never fetch a byte of it.

**Commit small samples only (a few MB each).** Rejected. Samples small enough to
commit are too short to exercise the cases that matter — segment boundaries,
seek behaviour, bitrate ladders, and metadata that appears only in longer files.

**Generate everything, no downloads at all.** Very attractive, and the reason
Tier 0 is the default. Rejected as the complete answer because real-world
Dolby Vision RPUs, HDR10+ dynamic metadata, and the muxer quirks found in files
from actual consumer devices cannot be synthesised faithfully — and those are
exactly the cases ADR-0010 targets.

**Object storage (S3/R2) with signed URLs.** Rejected for now. GitHub release
assets are free, stable, and adequate. Revisit if bandwidth becomes a problem.

## Revisit when

- Tier 1 grows past roughly 2 GB, making per-PR fetches slow.
- GitHub release asset bandwidth becomes a practical limit.
- Fixture URL rot becomes a recurring maintenance burden.
