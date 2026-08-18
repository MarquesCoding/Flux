import { describe, expect, it } from 'vitest';
import type { Monitor } from '@FluxClient/admin/fetchAdmin';
import { cacheRows } from './cacheRows';

const cache = (overrides: Partial<NonNullable<Monitor['cache']>> = {}): Monitor['cache'] => ({
  previews: { count: 12, bytes: 3 * 1024 ** 3 },
  trickplay: { count: 12, bytes: 500 * 1024 ** 2 },
  sessions: { count: 1, bytes: 40 * 1024 ** 2 },
  atMs: 1,
  ...overrides,
});

const labelled = (label: string, rows: ReturnType<typeof cacheRows>) =>
  rows.find((row) => row.label === label);

describe('cacheRows', () => {
  it('names every kind, even before anything has been counted', () => {
    expect(cacheRows(null, null, 0, null).map((row) => row.label)).toEqual([
      'Preview clips',
      'Scrub thumbnails',
      'Transcode sessions',
      'Artwork',
      'Media library',
    ]);
  });

  it('says it is still counting rather than claiming an empty cache', () => {
    const rows = cacheRows(null, null, 0, null);

    expect(rows.every((row) => row.value === '—')).toBe(true);
    expect(rows.every((row) => row.detail === 'Still counting')).toBe(true);
  });

  it('reports what each kind costs', () => {
    const rows = cacheRows(cache(), { count: 40, bytes: 20 * 1024 ** 2, atMs: 1 }, 0, null);

    expect(labelled('Preview clips', rows)?.value).toBe('3.0 GB');
    expect(labelled('Scrub thumbnails', rows)?.value).toBe('500 MB');
    expect(labelled('Artwork', rows)?.value).toBe('20 MB');
  });

  it('counts each kind in its own words', () => {
    const rows = cacheRows(cache(), { count: 40, bytes: 1, atMs: 1 }, 0, null);

    expect(labelled('Preview clips', rows)?.detail).toBe('12 clips');
    expect(labelled('Scrub thumbnails', rows)?.detail).toBe('12 sets');
    expect(labelled('Artwork', rows)?.detail).toBe('40 images');
  });

  it('does not say "1 items"', () => {
    const rows = cacheRows(
      cache({ previews: { count: 1, bytes: 1 }, sessions: { count: 1, bytes: 1 } }),
      { count: 1, bytes: 1, atMs: 1 },
      1,
      null,
    );

    expect(labelled('Preview clips', rows)?.detail).toBe('1 clip');
    expect(labelled('Artwork', rows)?.detail).toBe('1 image');
  });

  describe('transcode working directories', () => {
    it('reports them as running when that is what they are', () => {
      const rows = cacheRows(cache({ sessions: { count: 2, bytes: 100 } }), null, 2, null);

      expect(labelled('Transcode sessions', rows)?.detail).toBe('2 running');
    });

    it('does not report an abandoned directory as work in progress', () => {
      const rows = cacheRows(
        cache({ sessions: { count: 112, bytes: 65 * 1024 ** 3 } }),
        null,
        1,
        null,
      );

      expect(labelled('Transcode sessions', rows)?.detail).toBe('111 left behind');
    });

    it('counts what is left behind rather than what is on the disk', () => {
      const rows = cacheRows(cache({ sessions: { count: 3, bytes: 10 } }), null, 2, null);

      expect(labelled('Transcode sessions', rows)?.detail).toBe('1 left behind');
    });

    it('does not go negative when more are running than have directories', () => {
      const rows = cacheRows(cache({ sessions: { count: 1, bytes: 10 } }), null, 4, null);

      expect(labelled('Transcode sessions', rows)?.detail).toBe('1 running');
    });
  });

  it('reports the kinds one service knows while the other is still counting', () => {
    const rows = cacheRows(cache(), null, 0, null);

    expect(labelled('Preview clips', rows)?.value).toBe('3.0 GB');
    expect(labelled('Artwork', rows)?.detail).toBe('Still counting');
  });

  it('reports artwork while the media service is still counting', () => {
    const rows = cacheRows(null, { count: 3, bytes: 1024, atMs: 1 }, 0, null);

    expect(labelled('Artwork', rows)?.value).toBe('1.0 KB');
    expect(labelled('Preview clips', rows)?.detail).toBe('Still counting');
  });

  it('reports an empty cache as empty once it has actually been counted', () => {
    const rows = cacheRows(
      cache({ previews: { count: 0, bytes: 0 } }),
      { count: 0, bytes: 0, atMs: 1 },
      0,
      null,
    );

    expect(labelled('Preview clips', rows)?.value).toBe('0 B');
    expect(labelled('Preview clips', rows)?.detail).toBe('0 clips');
  });
});
