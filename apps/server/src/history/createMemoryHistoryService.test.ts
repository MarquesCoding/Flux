import { describe, expect, it } from 'vitest';
import { createMemoryHistoryService } from './createMemoryHistoryService';
import { SAME_VIEWING_MILLISECONDS } from './decideViewing';

const at = (millisecondsFromStart = 0) => new Date(1_700_000_000_000 + millisecondsFromStart);

const watched = (secondsWatched = 300, isFinished = false, millisecondsFromStart = 0) => ({
  at: at(millisecondsFromStart),
  secondsWatched,
  isFinished,
});

describe('a profile’s viewing history', () => {
  it('has nothing in it to begin with', async () => {
    const history = createMemoryHistoryService();

    expect(await history.list('profile-1')).toEqual([]);
  });

  it('remembers something watched', async () => {
    const history = createMemoryHistoryService();

    const viewing = await history.record('profile-1', 'media-1', watched());

    expect(viewing?.secondsWatched).toBe(300);
    expect(await history.list('profile-1')).toHaveLength(1);
  });

  it('does not remember something barely opened', async () => {
    const history = createMemoryHistoryService();

    expect(await history.record('profile-1', 'media-1', watched(5))).toBeNull();
    expect(await history.list('profile-1')).toEqual([]);
  });

  it('keeps one sitting as one row however often the player reports', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched(300, false, 0));
    await history.record('profile-1', 'media-1', watched(300, false, 30_000));
    await history.record('profile-1', 'media-1', watched(300, false, 60_000));

    const listed = await history.list('profile-1');

    expect(listed).toHaveLength(1);
    expect(listed[0]?.secondsWatched).toBe(900);
  });

  it('records a rewatch as its own row', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched(7_200, true, 0));
    await history.record('profile-1', 'media-1', watched(7_200, true, SAME_VIEWING_MILLISECONDS));

    expect(await history.list('profile-1')).toHaveLength(2);
  });

  it('keeps one profile’s viewing out of another’s', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched());
    await history.record('profile-2', 'media-1', watched());

    expect(await history.list('profile-1')).toHaveLength(1);
    expect(await history.list('profile-2')).toHaveLength(1);
  });

  it('puts the most recently watched first, which is how it is read', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched(300, false, 0));
    await history.record('profile-1', 'media-2', watched(300, false, 60_000));

    expect((await history.list('profile-1'))[0]?.mediaItemId).toBe('media-2');
  });

  it('answers a page at a time, since this grows for ever', async () => {
    const history = createMemoryHistoryService();

    for (const index of [0, 1, 2]) {
      await history.record('profile-1', `media-${index.toString()}`, watched(300, false, index));
    }

    expect(await history.list('profile-1', { limit: 2 })).toHaveLength(2);
    expect(await history.list('profile-1', { limit: 2, offset: 2 })).toHaveLength(1);
  });

  it('lets a viewer forget one thing they watched', async () => {
    const history = createMemoryHistoryService();

    const viewing = await history.record('profile-1', 'media-1', watched());

    expect(await history.forget('profile-1', viewing?.id ?? '')).toBe(true);
    expect(await history.list('profile-1')).toEqual([]);
  });

  it('refuses to forget something belonging to somebody else', async () => {
    const history = createMemoryHistoryService();

    const viewing = await history.record('profile-1', 'media-1', watched());

    expect(await history.forget('profile-2', viewing?.id ?? '')).toBe(false);
    expect(await history.list('profile-1')).toHaveLength(1);
  });

  it('lets a viewer forget the lot, and leaves everybody else alone', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched());
    await history.record('profile-1', 'media-2', watched());
    await history.record('profile-2', 'media-1', watched());

    expect(await history.forgetAll('profile-1')).toBe(2);
    expect(await history.list('profile-1')).toEqual([]);
    expect(await history.list('profile-2')).toHaveLength(1);
  });

  it('remembers that something was finished', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched(300, false, 0));
    await history.record('profile-1', 'media-1', watched(60, true, 60_000));

    expect((await history.list('profile-1'))[0]?.isFinished).toBe(true);
  });

  it('forgets viewings older than the horizon', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched(300, false, 0));
    await history.record('profile-2', 'media-2', watched(300, false, 86_400_000));

    expect(await history.prune(at(43_200_000))).toBe(1);
    expect(await history.list('profile-1')).toEqual([]);
    expect(await history.list('profile-2')).toHaveLength(1);
  });

  it('forgets nothing when everything is recent enough to keep', async () => {
    const history = createMemoryHistoryService();

    await history.record('profile-1', 'media-1', watched());

    expect(await history.prune(at(-86_400_000))).toBe(0);
  });
});
