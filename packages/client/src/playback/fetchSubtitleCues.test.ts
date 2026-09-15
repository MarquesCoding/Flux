import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSubtitleCues, subtitleCuesUrl } from './fetchSubtitleCues';

const A_CUE = {
  from: 1,
  to: 2,
  spans: [
    {
      text: 'CLOSED',
      fontFamily: 'Impact',
      fontHeight: 0.0667,
      colour: '#ff0000',
      opacity: 1,
      isBold: true,
      isItalic: false,
      isUnderlined: false,
      isStruckThrough: false,
    },
  ],
  alignment: 7,
  position: { x: 0.75, y: 0.2 },
  margins: { left: 0, right: 0, vertical: 0 },
  isSign: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const answers = <T>(answer: { ok: boolean; json: () => Promise<T> }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer));
};

describe('the address a track’s styled lines are asked for', () => {
  it('asks the track for its lines', () => {
    expect(subtitleCuesUrl('film', 'track')).toBe('/api/media/film/subtitles/track/cues?from=0');
  });

  it('says how far in the stream begins, in whole seconds', () => {
    expect(subtitleCuesUrl('film', 'track', 92.7)).toContain('from=92');
  });

  it('never asks for a negative start, which is not a place in a film', () => {
    expect(subtitleCuesUrl('film', 'track', -30)).toContain('from=0');
  });
});

describe('reading a track as styled lines', () => {
  it('reads the lines where the track has them', async () => {
    answers({ ok: true, json: () => Promise.resolve({ cues: [A_CUE] }) });

    const cues = await fetchSubtitleCues('/cues');

    expect(cues?.[0]?.spans[0]?.text).toBe('CLOSED');
    expect(cues?.[0]?.isSign).toBe(true);
  });

  it('answers with nothing where the track carries no styling', async () => {
    answers({ ok: false, json: () => Promise.resolve({ error: 'no' }) });

    await expect(fetchSubtitleCues('/cues')).resolves.toBeNull();
  });

  it('answers with nothing rather than throwing where the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchSubtitleCues('/cues')).resolves.toBeNull();
  });

  it('refuses an answer that is not the shape it asked for', async () => {
    answers({ ok: true, json: () => Promise.resolve({ cues: [{ from: 'soon' }] }) });

    await expect(fetchSubtitleCues('/cues')).resolves.toBeNull();
  });

  it('refuses an answer that is not JSON at all', async () => {
    answers({ ok: true, json: () => Promise.reject(new Error('not json')) });

    await expect(fetchSubtitleCues('/cues')).resolves.toBeNull();
  });
});
