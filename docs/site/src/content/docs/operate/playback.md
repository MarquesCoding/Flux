---
title: Playback and transcoding
description: What Valence decides, why, and how to find out.
---

## Why is this transcoding?

Press the playback mode button while a film is playing and Valence will tell you,
per stream:

```
Video: Client does not support the hevc video codec
Audio: Client does not support the eac3 audio codec
```

The same answer is available without starting playback:

```bash
curl -X POST /api/playback/{mediaId}/explain \
  -H 'content-type: application/json' \
  -d '{"deviceProfile": { ... }}'
```

This exists because "why is this transcoding?" is one of the most common
questions asked of a media server, and the answer already exists inside the
decision. Throwing it away and making people read server logs is a choice.

## Each stream is decided separately

Container, video, audio and subtitles are decided independently. A video codec
your client cannot play will never cause your lossless audio to be re-encoded
as a side effect.

## Direct play

When nothing needs changing, Valence sends the original file over byte ranges: no
transcode, no remux, no segment cache, and no load on the media service at all.

## Seeking a transcode

A transcode only exists from the point it started, so seeking is two different
operations depending on where you land.

Inside what has already been encoded, the player moves within the current
session and nothing is asked of the server. Beyond it, the old session is
stopped and a new one starts at that timestamp — ffmpeg seeks the input rather
than decoding up to it, so this takes about a second regardless of how far in
you jump.

Direct play skips all of this: the original file is served over byte ranges and
the browser seeks it directly.

## Seek-bar previews

Hovering the scrub bar shows the frame you would land on. Valence renders those
thumbnails by decoding the file once, every ten seconds of runtime, into tiled
JPEG sheets indexed with WebVTT.

The first request for a long film takes a while, because it reads the whole
file. The result is content addressed, so every later request — including after
a restart — reuses what is already on disk. Playback never waits for it: the
stream starts first and previews appear when they are ready.

Sheets live in the transcode cache. Deleting that directory costs nothing but
the decoding time to rebuild it.

## Stats for nerds

The sliders button on the control bar opens a panel showing everything Valence
knows about what is on screen: the session and how it is being delivered, the
decision and reason on each of the four axes, what the source actually is, and
what the browser is managing to do with it — buffered ahead, how much has been
encoded, the size being decoded, and frames dropped.

Frame counts are reported as _not reported_ rather than as zero where a browser
does not keep them, because a decoder dropping frames is exactly when someone
opens this panel and a confident zero would be a lie.

## Subtitles

Valence plays the subtitle files sitting next to your media — what Jellyfin calls
external subtitles. `Arrival (2016).en.srt`, `Arrival (2016).fr.forced.srt` and
a `Subs/English.srt` are all found, with the language, forced and SDH flags
read from the filename.

SubRip, WebVTT and Advanced SubStation are supported. Everything is converted
to WebVTT on the way out because that is the only format a browser renders; an
ASS script keeps its dialogue and loses its own fonts, colours and positioning,
since captions are styled to the viewer's preference instead.

Picture-based tracks — `.sup`, `.idx`/`.sub` — are ignored. Turning those into
text means character recognition, which is not something to do inside a
playback request. They are the burn-in case instead.

Nothing is demuxed out of the container, and nothing is fetched from the
internet. A plugin that downloads subtitles writes files beside the media, and
they then appear like any other.

### Choosing a soundtrack

A file carrying more than one audio stream offers them in the same menu as the
subtitles. Picking one restarts playback where you left off rather than at the
beginning.

Choosing a track rules out direct play. The original file carries every stream
and leaves the choice to the browser, so selecting one specifically means Valence
has to produce a stream containing only it.

### How captions look

Font, size, colour, background, opacity and edge treatment are all yours to
set, from the subtitles menu. The preview in the panel is drawn with the same
properties the cues get, so what you choose is what appears.

The settings live in the browser rather than on your account, because captions
are read at arm's length on a laptop and across a room on a television, and the
right size differs per screen rather than per person.

## Skipping intros

Valence marks the intro, recap and credits of an episode, and offers a button for
the first few seconds of each. Someone who wants to watch the theme should not
spend the whole of it being asked whether they meant it.

Ranges come from two places, in order.

**Chapters.** Where a release named a chapter `Intro`, `Opening`, `Previously`
or `Credits`, that is exact and free — nothing is detected and no audio is read.
Only unambiguous names are used: `Part 1` might be anything, and guessing wrong
skips the opening scene.

**Listening.** Otherwise Valence compares the episodes of a season to each other.
The first ten minutes of each is decoded to mono, reduced to a compact hash per
frame of its spectral shape, and every pair of episodes is compared at every
plausible alignment. The longest run of matching frames is the audio those two
episodes share — and two episodes of one series share exactly one substantial
thing. A range that several independent pairs agree on is kept; one that a
single pair found is discarded, because one pair can agree on a coincidence.

Detection needs at least three episodes in a season, runs after a scan rather
than during it, and compares at most eight episodes — a theme is no more
discoverable from twenty examples than from eight. Seasons are compared
separately, since a theme is often re-recorded between them, and films are
skipped entirely as they have nothing to be compared against.

A range is only believed if it is plausible: an intro is between ten seconds and
three minutes and begins in the first part of the runtime. A measurement saying
the intro is forty minutes long is wrong however confidently it was arrived at,
and no button is far better than one that skips half the episode.
