# Security

## Reporting a vulnerability

**Do not open a public issue.**

Use GitHub's private reporting, which is the fastest route to somebody who can
act on it:

[Report a vulnerability](https://github.com/MarquesCoding/Valence/security/advisories/new)

Tell us what you can reach, how you reached it, and what it gets you. A request
that demonstrates it is worth more than a description of the class of problem. If
you have a patch, say so and we will work it through the advisory rather than in
the open.

You will get an acknowledgement within a few days. Valence is maintained by a
small number of people, so an exploit chain may take longer to confirm than to
report.

## What is in scope

- **The server**, and anything reachable through `/api`.
- **The session gate and the permission model.** A route that acts on something
  without checking whose it is, or a permission that turns out to be a way round
  the permission beside it.
- **The share gate.** A share link is a way in for somebody with no account; it
  is never a second set of permissions for somebody who has one.
- **The plugin broker.** Anything letting plugin code reach the filesystem, the
  network, or session data outside its granted capabilities is treated as
  critical. Plugins run in a process of their own and reach everything through a
  broker precisely so that this is a boundary, and we would very much like to
  hear about holes in it.
- **The transcoder**, including anything a crafted media file can make it do.

## What is known, and not a finding

Valence has no per-account entitlement model. Every signed-in account may read
every item in every library: its segments, its subtitles, its artwork and its
original file. A Valence server is a household, and everyone who can sign in may
watch everything in it.

That is a decided property rather than an oversight, so please do not report it
as one. If you can read library content **without** an account, or as a share
guest beyond what the link covers, that is very much a finding.

## Supported versions

Valence has not cut its first release. Until it does, the supported version is
whatever `main` is, and fixes land there.
