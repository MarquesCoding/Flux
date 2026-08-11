import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTrickplay, parseTrickplayIndex, thumbnailAt, readTimestamp } from './fetchTrickplay';

const INDEX_URL = '/api/playback/trickplay/thumbs/thumbnails.vtt';

const VTT = [
  'WEBVTT',
  '',
  '00:00:00.000 --> 00:00:10.000',
  'sheet-001.jpg#xywh=0,0,320,180',
  '',
  '00:00:10.000 --> 00:00:20.000',
  'sheet-001.jpg#xywh=320,0,320,180',
  '',
].join('\n');

const respondWith = (responses: Record<string, { ok: boolean; body: string }>) => {
  const fetchImpl = vi.fn((input: string) => {
    const answer = responses[input];

    if (answer === undefined) {
      return Promise.resolve({ ok: false, status: 404 });
    }

    return Promise.resolve({
      ok: answer.ok,
      status: answer.ok ? 200 : 500,
      json: () => Promise.resolve(JSON.parse(answer.body)),
      text: () => Promise.resolve(answer.body),
    });
  });

  vi.stubGlobal('fetch', fetchImpl);

  return fetchImpl;
};

const index = JSON.stringify({
  id: 'thumbs',
  url: INDEX_URL,
  intervalSeconds: 10,
  tileWidth: 320,
  tileHeight: 180,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readTimestamp', () => {
  it('reads a WebVTT timestamp as seconds', () => {
    expect(readTimestamp('01:02:05.500')).toBe(3725.5);
  });

  it('reads a timestamp with no fraction', () => {
    expect(readTimestamp('00:00:10')).toBe(10);
  });

  it('reports nothing for a line that is not a timestamp', () => {
    expect(readTimestamp('sheet-001.jpg')).toBeNull();
  });
});

describe('parseTrickplayIndex', () => {
  it('reads every cue', () => {
    expect(parseTrickplayIndex(VTT, INDEX_URL)).toHaveLength(2);
  });

  it('reads the rectangle a cue points at', () => {
    expect(parseTrickplayIndex(VTT, INDEX_URL)[1]).toMatchObject({
      startSeconds: 10,
      endSeconds: 20,
      x: 320,
      y: 0,
      width: 320,
      height: 180,
    });
  });

  it('resolves sheet names against the index, as a browser would', () => {
    expect(parseTrickplayIndex(VTT, INDEX_URL)[0]?.sheetUrl).toContain(
      '/api/playback/trickplay/thumbs/sheet-001.jpg',
    );
  });

  it('skips a cue that names no rectangle rather than guessing one', () => {
    const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nsheet-001.jpg\n';

    expect(parseTrickplayIndex(vtt, INDEX_URL)).toHaveLength(0);
  });

  it('reads nothing from an empty index', () => {
    expect(parseTrickplayIndex('WEBVTT\n\n', INDEX_URL)).toHaveLength(0);
  });
});

describe('thumbnailAt', () => {
  const thumbnails = parseTrickplayIndex(VTT, INDEX_URL);

  it('finds the thumbnail covering a moment', () => {
    expect(thumbnailAt(thumbnails, 12)?.startSeconds).toBe(10);
  });

  it('holds the last thumbnail past the end of the index', () => {
    expect(thumbnailAt(thumbnails, 9999)?.startSeconds).toBe(10);
  });

  it('shows the first thumbnail before the first cue', () => {
    expect(thumbnailAt(thumbnails, -5)?.startSeconds).toBe(0);
  });

  it('reports nothing when there are no thumbnails', () => {
    expect(thumbnailAt([], 12)).toBeNull();
  });
});

describe('fetchTrickplay', () => {
  it('reads the index the server points at', async () => {
    respondWith({
      '/api/playback/abc/trickplay': { ok: true, body: index },
      [INDEX_URL]: { ok: true, body: VTT },
    });

    const trickplay = await fetchTrickplay('abc');

    expect(trickplay).toMatchObject({ width: 320, height: 180 });
    expect(trickplay?.thumbnails).toHaveLength(2);
  });

  it('answers with nothing when the server cannot make previews', async () => {
    respondWith({});

    await expect(fetchTrickplay('abc')).resolves.toBeNull();
  });

  it('answers with nothing when the index cannot be read', async () => {
    respondWith({ '/api/playback/abc/trickplay': { ok: true, body: index } });

    await expect(fetchTrickplay('abc')).resolves.toBeNull();
  });

  it('answers with nothing when the index holds no usable cues', async () => {
    respondWith({
      '/api/playback/abc/trickplay': { ok: true, body: index },
      [INDEX_URL]: { ok: true, body: 'WEBVTT\n\n' },
    });

    await expect(fetchTrickplay('abc')).resolves.toBeNull();
  });
});
