---
title: Playback and transcoding
description: What Flux decides, why, and how to find out.
---

## Why is this transcoding?

Press the playback mode button while a film is playing and Flux will tell you,
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

When nothing needs changing, Flux sends the original file over byte ranges: no
transcode, no remux, no segment cache, and no load on the media service at all.
