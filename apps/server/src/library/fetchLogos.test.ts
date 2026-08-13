import { describe, expect, it, vi } from 'vitest';
import { fetchLogos } from './fetchLogos';
import type { LogolessItem } from './fetchLogos';

const item = (id: string, overrides: Partial<LogolessItem> = {}): LogolessItem => ({
  id,
  externalId: `tmdb-${id}`,
  isSeries: false,
  ...overrides,
});

const storeOf = (items: LogolessItem[]) => {
  const saved = new Map<string, string>();

  return {
    saved,
    listMissing: vi.fn(() => Promise.resolve(items)),
    save: vi.fn((mediaItemId: string, logoUrl: string) => {
      saved.set(mediaItemId, logoUrl);

      return Promise.resolve();
    }),
  };
};

describe('fetchLogos', () => {
  it('does nothing at all when no provider can supply lettering', async () => {
    const store = storeOf([item('a')]);

    expect(await fetchLogos({ libraryId: 'lib', store })).toEqual({ found: 0, missing: 0 });
    expect(store.listMissing).not.toHaveBeenCalled();
  });

  it('keeps what a catalogue answers with', async () => {
    const store = storeOf([item('a'), item('b')]);

    const result = await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl: ({ externalId }) => Promise.resolve(`https://art/${externalId}.png`),
    });

    expect(result).toEqual({ found: 2, missing: 0 });
    expect(store.saved.get('a')).toBe('https://art/tmdb-a.png');
  });

  it('asks about a programme as a programme rather than as a film', async () => {
    const store = storeOf([item('a', { isSeries: true })]);
    const readLogoUrl = vi.fn(() => Promise.resolve(null));

    await fetchLogos({ libraryId: 'lib', store, readLogoUrl });

    expect(readLogoUrl).toHaveBeenCalledWith({ externalId: 'tmdb-a', isSeries: true });
  });

  it('leaves an item alone rather than recording it as failed when there is simply none', async () => {
    const store = storeOf([item('a')]);
    const onProblem = vi.fn();

    const result = await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl: () => Promise.resolve(null),
      onProblem,
    });

    expect(result).toEqual({ found: 0, missing: 1 });
    expect(onProblem).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it('carries on past an item the catalogue refused, and says which', async () => {
    const store = storeOf([item('a'), item('b')]);
    const onProblem = vi.fn();

    const result = await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl: ({ externalId }) =>
        externalId === 'tmdb-a'
          ? Promise.reject(new Error('Too many requests.'))
          : Promise.resolve('https://art/b.png'),
      onProblem,
    });

    expect(result).toEqual({ found: 1, missing: 1 });
    expect(onProblem).toHaveBeenCalledWith('a', 'Too many requests.');
    expect(store.saved.get('b')).toBe('https://art/b.png');
  });

  it('stops between items when somebody has cancelled the job', async () => {
    const store = storeOf([item('a'), item('b'), item('c')]);
    const readLogoUrl = vi.fn(() => Promise.resolve('https://art/one.png'));

    const result = await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl,
      isCancelled: () => readLogoUrl.mock.calls.length >= 1,
    });

    expect(result.found).toBe(1);
    expect(readLogoUrl).toHaveBeenCalledTimes(1);
  });

  it('reports how far it has got, starting from nothing done', async () => {
    const store = storeOf([item('a'), item('b')]);
    const onProgress = vi.fn();

    await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl: () => Promise.resolve(null),
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('says something useful when a catalogue fails in a way that is not an error', async () => {
    const store = storeOf([item('a')]);
    const onProblem = vi.fn();

    await fetchLogos({
      libraryId: 'lib',
      store,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the point of this test is a rejection that is not an Error
      readLogoUrl: () => Promise.reject('a bare string'),
      onProblem,
    });

    expect(onProblem).toHaveBeenCalledWith('a', 'The catalogue did not answer.');
  });

  it('does not insist on being told about problems at all', async () => {
    const store = storeOf([item('a')]);

    const result = await fetchLogos({
      libraryId: 'lib',
      store,
      readLogoUrl: () => Promise.reject(new Error('nope')),
    });

    expect(result).toEqual({ found: 0, missing: 1 });
  });
});
