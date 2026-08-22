---
title: Media libraries
description: How Valence reads your files, and what it will never do to them.
---

## Valence never writes to your library

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

## Rescanning

An ordinary scan only probes files whose size or modification time changed.
That is what makes rescanning a library of thousands of files cheap enough to
do often.

It also means a change in how Valence _reads_ a file never reaches media already
in the library, because the file on disk did not change. After upgrading to a
release that fixes probing, or installing a metadata plugin, use a full rescan:

```sh
curl -X POST 'http://localhost:8420/api/libraries/<id>/scan?force=true'
```

The **Full rescan** button does the same thing. It probes every file again, so
it costs roughly what the first scan of that library cost. Files that have
disappeared are still removed either way.

## Where titles come from

Valence ships one metadata provider, and it reads the filename. `Arrival (2016).mkv`
becomes _Arrival_, 2016. Scene-release noise — resolutions, codecs, group tags —
is stripped.

Set `CATALOGUE_API_KEY` and a richer provider takes over: overview, tagline,
genres, cast, rating, poster and backdrop, searched by title and year — or by
series name for anything that looks like an episode. The filename reader stays
behind it, so a catalogue that is unconfigured, down, or simply ignorant of a
file leaves you with the name on disk rather than a blank entry.

Artwork is fetched once and cached in `IMAGE_CACHE_DIR`, then served by Valence.
A browser drawing your library therefore never talks to the catalogue, which is
the point of self-hosting, and your covers do not vanish when a third party
reorganises its URLs.

That is deliberately the floor rather than the ceiling. Richer metadata means
talking to a third-party service, and which service that is should be your
choice, not a decision baked into the server. Providers are an extension point:
a plugin registers one, providers are asked in order, and the first answer wins,
so a plugin overrides the built-in reader without replacing it.

A provider that fails is skipped rather than failing the scan. A metadata
service being down must not make your library unreadable.

## Finding things again

Search reads what a catalogue stored, not only what a file is called. Typing a
name finds titles, series names, descriptions, taglines and cast, so an actor's
name finds their films and half a remembered plot finds the film it belongs to.

The filters beside it narrow rather than search: genre, decade, and a rating
floor. They combine, so "the well-reviewed science fiction of the nineties" is
one set of presses rather than a question Valence cannot answer.

Every filter is offered only where something answers to it. A library with no
westerns in it is not shown a western chip, and one nobody has matched against
a catalogue is offered no rating floor at all — a control whose only possible
outcome is an empty page is worse than no control.

Ratings work the same way at the item level: something nobody has scored is
left out of a search asking for at least seven, rather than passing by
default.
