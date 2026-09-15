import { describe, expect, it, vi } from 'vitest';
import { createLayeredSubtitleService } from './createLayeredSubtitleService';
import type { AssCue } from '@ValenceCore/functions/parseAdvancedSubStation';
import type { SubtitleService, SubtitleTrack } from './SubtitleService';

const MEDIA_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

const trackOf = (id: string): SubtitleTrack => ({
  id,
  label: id,
  language: 'en',
  format: 'vtt',
  isForced: false,
  isHearingImpaired: false,
  delivery: 'text',
  streamIndex: null,
});

/**
 * A source with a fixed answer.
 */
const sourceOf = (
  tracks: SubtitleTrack[] | null,
  content: Record<string, string> = {},
  cues: Record<string, AssCue[]> = {},
): SubtitleService => ({
  list: () => Promise.resolve(tracks),
  read: (_mediaId, trackId) => Promise.resolve(content[trackId] ?? null),
  readCues: (_mediaId, trackId) => Promise.resolve(cues[trackId] ?? null),
});

const cueOf = (text: string): AssCue => ({
  from: 0,
  to: 1,
  spans: [
    {
      text,
      fontFamily: null,
      fontHeight: null,
      colour: null,
      opacity: null,
      isBold: false,
      isItalic: false,
      isUnderlined: false,
      isStruckThrough: false,
    },
  ],
  alignment: 2,
  position: null,
  margins: { left: 0, right: 0, vertical: 0 },
  isSign: false,
});

describe('createLayeredSubtitleService', () => {
  it('presents every source as one menu', async () => {
    const layered = createLayeredSubtitleService([
      sourceOf([trackOf('sidecar')]),
      sourceOf([trackOf('embedded')]),
    ]);

    await expect(layered.list(MEDIA_ID)).resolves.toHaveLength(2);
  });

  it('keeps the order it was given, so a hand-picked sidecar leads', async () => {
    const layered = createLayeredSubtitleService([
      sourceOf([trackOf('sidecar')]),
      sourceOf([trackOf('embedded')]),
    ]);

    const tracks = await layered.list(MEDIA_ID);

    expect(tracks?.map((track) => track.id)).toEqual(['sidecar', 'embedded']);
  });

  it('says it has never heard of an item only when nothing has', async () => {
    const layered = createLayeredSubtitleService([sourceOf(null), sourceOf(null)]);

    await expect(layered.list(MEDIA_ID)).resolves.toBeNull();
  });

  it('does not mistake a source with nothing to add for an item that does not exist', async () => {
    const layered = createLayeredSubtitleService([sourceOf(null), sourceOf([])]);

    await expect(layered.list(MEDIA_ID)).resolves.toEqual([]);
  });

  it('reads a track from whichever source has it', async () => {
    const layered = createLayeredSubtitleService([
      sourceOf([trackOf('sidecar')], {}),
      sourceOf([trackOf('embedded')], { embedded: 'WEBVTT' }),
    ]);

    await expect(layered.read(MEDIA_ID, 'embedded')).resolves.toBe('WEBVTT');
  });

  it('stops asking once a source has answered', async () => {
    const second = sourceOf([trackOf('embedded')], { embedded: 'WEBVTT' });
    const read = vi.spyOn(second, 'read');
    const layered = createLayeredSubtitleService([
      sourceOf([trackOf('sidecar')], { sidecar: 'WEBVTT' }),
      second,
    ]);

    await layered.read(MEDIA_ID, 'sidecar');

    expect(read).not.toHaveBeenCalled();
  });

  it('answers with nothing for a track no source has', async () => {
    const layered = createLayeredSubtitleService([sourceOf([trackOf('sidecar')])]);

    await expect(layered.read(MEDIA_ID, 'nowhere')).resolves.toBeNull();
  });

  it('knows of nothing at all when it was given no sources', async () => {
    const layered = createLayeredSubtitleService([]);

    await expect(layered.list(MEDIA_ID)).resolves.toBeNull();
  });

  it('asks each source for a styled track until one of them has it', async () => {
    const layered = createLayeredSubtitleService([
      sourceOf([trackOf('embedded')]),
      sourceOf([trackOf('sidecar')], {}, { sidecar: [cueOf('a sign')] }),
    ]);

    const cues = await layered.readCues(MEDIA_ID, 'sidecar');

    expect(cues?.[0]?.spans[0]?.text).toBe('a sign');
  });

  it('answers with nothing where no source has a styled form of that track', async () => {
    const layered = createLayeredSubtitleService([sourceOf([trackOf('embedded')])]);

    await expect(layered.readCues(MEDIA_ID, 'embedded')).resolves.toBeNull();
  });
});
