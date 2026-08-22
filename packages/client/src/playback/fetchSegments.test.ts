import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSegments, skippableAt, describeSkip } from './fetchSegments';
import type { MediaSegment } from '@ValenceContracts/schemas/MediaSegment';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

const intro: MediaSegment = {
  kind: 'intro',
  startSeconds: 30,
  endSeconds: 120,
  source: 'fingerprint',
};

const respondWith = (answer: { ok: boolean; body: JsonValue }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: answer.ok,
        status: answer.ok ? 200 : 404,
        json: () => Promise.resolve(answer.body),
      }),
    ),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('skippableAt', () => {
  it('offers a skip as the intro begins', () => {
    expect(skippableAt([intro], 30)?.kind).toBe('intro');
  });

  it('still offers it a moment later, for anyone who looked away', () => {
    expect(skippableAt([intro], 38)).not.toBeNull();
  });

  it('stops offering it once the intro is well under way', () => {
    expect(skippableAt([intro], 60)).toBeNull();
  });

  it('offers nothing before the intro starts', () => {
    expect(skippableAt([intro], 10)).toBeNull();
  });

  it('offers nothing after the intro has finished', () => {
    expect(skippableAt([intro], 200)).toBeNull();
  });

  it('never offers to skip a preview of the next episode', () => {
    const preview: MediaSegment = {
      kind: 'preview',
      startSeconds: 30,
      endSeconds: 60,
      source: 'manual',
    };

    expect(skippableAt([preview], 35)).toBeNull();
  });

  it('does not outlast a segment shorter than the offer', () => {
    const brief: MediaSegment = { ...intro, startSeconds: 30, endSeconds: 35 };

    expect(skippableAt([brief], 34)).not.toBeNull();
    expect(skippableAt([brief], 36)).toBeNull();
  });

  it('offers nothing at all when nothing is known', () => {
    expect(skippableAt([], 30)).toBeNull();
  });
});

describe('describeSkip', () => {
  it('names what is being skipped', () => {
    expect(describeSkip(intro)).toBe('Skip Intro');
    expect(describeSkip({ ...intro, kind: 'recap' })).toBe('Skip Recap');
    expect(describeSkip({ ...intro, kind: 'credits' })).toBe('Skip Credits');
  });
});

describe('fetchSegments', () => {
  it('reads what the server knows', async () => {
    respondWith({ ok: true, body: { segments: [intro] } });

    await expect(fetchSegments('media-1')).resolves.toEqual([intro]);
  });

  it('says so when the server refuses, rather than answering with nothing', async () => {
    respondWith({ ok: false, body: null });

    await expect(fetchSegments('media-1')).rejects.toThrow();
  });

  it('says so when the answer is not the shape it was promised', async () => {
    respondWith({ ok: true, body: { segments: [{ kind: 'nonsense' }] } });

    await expect(fetchSegments('media-1')).rejects.toThrow();
  });
});
