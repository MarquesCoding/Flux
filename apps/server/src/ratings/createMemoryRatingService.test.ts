import { describe, expect, it } from 'vitest';
import { createMemoryRatingService } from './createMemoryRatingService';

const FILM = '3f1a5d0e-1c2b-4c3d-8e4f-5a6b7c8d9e0f';

const SHOW = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b';

describe('createMemoryRatingService', () => {
  it('has nothing for a profile that has rated nothing', async () => {
    const ratings = createMemoryRatingService();

    await expect(ratings.list('nobody')).resolves.toEqual([]);
  });

  it('records a rating against an item', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 4);

    await expect(ratings.list('ada')).resolves.toEqual([
      { mediaId: FILM, seriesId: null, stars: 4, ratedAt: new Date(0).toISOString() },
    ]);
  });

  it('records a rating against a series without touching an item of the same id', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 4);
    await ratings.set('ada', { seriesId: FILM }, 2);

    const held = await ratings.list('ada');

    expect(held).toHaveLength(2);
    expect(held.find((one) => one.mediaId === FILM)?.stars).toBe(4);
    expect(held.find((one) => one.seriesId === FILM)?.stars).toBe(2);
  });

  it('replaces a rating rather than adding a second', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 4);
    await ratings.set('ada', { mediaId: FILM }, 2);

    const held = await ratings.list('ada');

    expect(held).toHaveLength(1);
    expect(held[0]?.stars).toBe(2);
  });

  it('clears a rating', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 4);
    await ratings.clear('ada', { mediaId: FILM });

    await expect(ratings.list('ada')).resolves.toEqual([]);
  });

  it('leaves other people alone when one profile clears theirs', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 4);
    await ratings.set('grace', { mediaId: FILM }, 5);
    await ratings.clear('ada', { mediaId: FILM });

    await expect(ratings.household({ mediaId: FILM })).resolves.toEqual({ average: 5, count: 1 });
  });

  it('averages what the household gave an item', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 5);
    await ratings.set('grace', { mediaId: FILM }, 4);
    await ratings.set('alan', { mediaId: FILM }, 3);

    await expect(ratings.household({ mediaId: FILM })).resolves.toEqual({ average: 4, count: 3 });
  });

  it('averages what the household gave a series', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { seriesId: SHOW }, 5);
    await ratings.set('grace', { seriesId: SHOW }, 2);

    await expect(ratings.household({ seriesId: SHOW })).resolves.toEqual({
      average: 3.5,
      count: 2,
    });
  });

  it('answers with nothing for a subject nobody has rated', async () => {
    const ratings = createMemoryRatingService();

    await expect(ratings.household({ mediaId: FILM })).resolves.toEqual({
      average: null,
      count: 0,
    });
  });

  it('reads the household figure for several items at once', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 5);
    await ratings.set('grace', { mediaId: FILM }, 3);
    await ratings.set('ada', { mediaId: SHOW }, 2);

    const found = await ratings.householdForItems([FILM, SHOW]);

    expect(found.get(FILM)).toEqual({ average: 4, count: 2 });
    expect(found.get(SHOW)).toEqual({ average: 2, count: 1 });
  });

  it('leaves an unrated item out of the batch rather than reporting it as zero', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { mediaId: FILM }, 5);

    const found = await ratings.householdForItems([FILM, SHOW]);

    expect(found.has(SHOW)).toBe(false);
  });

  it('does not count a series rating towards an item of the same id', async () => {
    const ratings = createMemoryRatingService();

    await ratings.set('ada', { seriesId: FILM }, 1);

    const found = await ratings.householdForItems([FILM]);

    expect(found.has(FILM)).toBe(false);
  });

  it('starts from whatever state it was given', async () => {
    const ratings = createMemoryRatingService({
      ada: [{ mediaId: FILM, seriesId: null, stars: 3, ratedAt: new Date(0).toISOString() }],
    });

    await expect(ratings.household({ mediaId: FILM })).resolves.toEqual({ average: 3, count: 1 });
  });
});
