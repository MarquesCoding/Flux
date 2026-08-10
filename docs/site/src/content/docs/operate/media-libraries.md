---
title: Media libraries
description: How Flux reads your files, and what it will never do to them.
---

## Flux never writes to your library

`/media` is mounted read-only, and that is an architectural rule rather than a
default. No metadata sidecars, no renamed files, no "organise" feature that
touches your source media. Anything that would write to your library is out of
scope for the server.

This is easier to hold from the start than to retrofit, and it is worth
something in a category where people are protective of collections they cannot
replace.

## Scanning

Scanning walks the library root, skips anything that is not a media file, and
probes what is left. A file already stored at the same size and modification
time is left alone, so rescanning a large library does not re-probe it.

Scans run in the background. The API answers `202` with a job identifier as
soon as the scan is queued; walking and probing a real library takes minutes,
and an HTTP request that long would be cut off by every proxy in between.

A file that cannot be probed is counted and reported, never fatal. One
unreadable file must not stop the other thousands from appearing.

## Titles come from filenames, for now

Until a metadata provider plugin is installed, titles and years are read from
the filename. Nothing about _playback_ is decided this way — codecs, ranges and
stream layout all come from probing the file itself, because filenames in real
libraries are unreliable.

## Where titles come from

Flux ships one metadata provider, and it reads the filename. `Arrival (2016).mkv`
becomes _Arrival_, 2016. Scene-release noise — resolutions, codecs, group tags —
is stripped.

That is deliberately the floor rather than the ceiling. Richer metadata means
talking to a third-party service, and which service that is should be your
choice, not a decision baked into the server. Providers are an extension point:
a plugin registers one, providers are asked in order, and the first answer wins,
so a plugin overrides the built-in reader without replacing it.

A provider that fails is skipped rather than failing the scan. A metadata
service being down must not make your library unreadable.
