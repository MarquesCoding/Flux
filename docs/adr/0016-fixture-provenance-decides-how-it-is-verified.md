# ADR-0016: Where a fixture came from decides how it is checked

- **Status:** Accepted
- **Date:** 2026-08-16
- **Deciders:** Daniel Morgan
- **Supersedes:** Partially supersedes [ADR-0012](0012-media-test-corpus-external-fixtures.md)
- **Superseded by:** —

## Context

[ADR-0012](0012-media-test-corpus-external-fixtures.md) designed the media corpus
before any of it existed, and building it turned two of its mechanics into
choices that could not both be kept.

It gives one rule for checksums: a mismatch is "a hard failure, never a warning".
That is exactly right for a file fetched from somebody else's server, where a
digest that has moved means the bytes have changed underneath us. It is wrong for
a file we generate, because those bytes are not fixed. A fixture built by an
arm64 laptop and one built by an amd64 runner differ while being equally correct
— x264 and x265 take different assembly paths — and so do two FFmpeg builds of
the same version. Enforced literally, the rule fails every run on a machine that
is not the one the manifest was written on, which teaches everyone to pass
`--force` and stops the checksum meaning anything at all.

It also says Tier 1 should be mirrored into our own release assets "rather than
hotlinking upstream", to survive URL rot. That assumed the tier would be freely
licensed material. In practice the files that cannot be generated are FFmpeg's
FATE samples and Fraunhofer's test signals: several FATE entries are excerpts of
commercial films, and the Fraunhofer page states no terms at all. Mirroring them
would mean serving media we have no licence to serve, to avoid an inconvenience.

Underneath both is the same question, which ADR-0012 did not need to ask because
it had not yet met the files: what a check is _for_ depends on where the bytes
came from.

## Decision

**A fixture is verified according to its provenance, and the manifest records
that provenance.**

- **Generated fixtures** are checked by **probing them**. Every one is read back
  and compared against what the matrix claims — codec, bit depth, GOP structure,
  range, scan, frame rate, pixel shape, channel count. A checksum that no longer
  matches **rebuilds the fixture and says so**; it is drift, not tampering, and
  the rebuild is cheap because the inputs are in the repository.
- **Fetched fixtures** are checked by **checksum**, and a mismatch is a hard
  failure exactly as ADR-0012 requires. These are somebody else's bytes and we
  have no other way to know they are the ones we tested against.
- **Fetched fixtures are never mirrored.** They are downloaded on demand into the
  local cache and are not redistributed, whatever the convenience.
- **Derived fixtures** — built by transcoding a fetched one, which is how the
  bitmap subtitle formats are reached — inherit the licence of their source and
  are treated as generated for verification, since we produced the bytes.

The corpus is generated against the FFmpeg Flux ships, not the host's.

## Consequences

### What this gets us

The checksum keeps its meaning in the one place it has one. Contributors on
different machines get a corpus that works rather than one that fails on first
run, and the property checks catch the thing that actually matters — a fixture
that is not what it claims. That has already earned itself three times over: it
caught an interlaced fixture that was progressive, and HDR10 and HLG fixtures
that read back as SDR because both encoders write the range into the bitstream
rather than onto the container.

We serve nothing we lack the right to serve.

### What this costs us

Generated fixtures are no longer bit-reproducible across machines, so the
manifest's digests for them are a record rather than a contract, and the manifest
churns when the pinned FFmpeg changes. Fetched fixtures now depend on somebody
else's uptime: a dead URL becomes a skipped test rather than a cached one, and
the tests that needed those bytes stop being run rather than stopping the build.

Verifying by probing is more code than comparing a digest, and the probe has to
be taught each property it checks.

### What this forecloses

Any claim that two machines produce a byte-identical corpus, and with it the
option of treating the manifest as a lockfile. Also the option of a fully offline
Tier 1, since nothing is mirrored.

## Alternatives considered

**Pin the FFmpeg build and keep checksums fatal everywhere.** The build is
already pinned and it is not enough — architecture alone changes the bytes.

**Regenerate the manifest in CI and commit it from there.** Makes the runner the
only machine that may write a manifest, and leaves every contributor's local
corpus permanently "wrong".

**Mirror Tier 1 into our own releases, as ADR-0012 suggested.** Solves URL rot by
redistributing material we have no licence to redistribute. The inconvenience is
smaller than the exposure.

**Drop checksums entirely.** Loses the one check that catches a fetched file
changing underneath us, which is the case they were introduced for.

## Revisit when

- A generated fixture's properties start needing more of the probe than is
  reasonable to maintain, suggesting the matrix has outgrown property checks.
- A Tier 1 URL actually rots, making the cost of not mirroring concrete rather
  than theoretical.
- Freely licensed replacements exist for the FATE and Fraunhofer samples, which
  would remove the reason not to mirror.
