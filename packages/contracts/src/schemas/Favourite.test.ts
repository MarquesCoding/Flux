import { describe, expect, it } from 'vitest';
import { FavouriteSchema, FavouriteListSchema } from './Favourite';

const kept = {
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  keptAt: '2026-08-10T00:00:00.000Z',
};

describe('FavouriteSchema', () => {
  it('accepts a mark against an item the library already describes', () => {
    expect(FavouriteSchema.parse(kept)).toEqual(kept);
  });

  it('insists the item is named the way the library names things', () => {
    expect(() => FavouriteSchema.parse({ ...kept, mediaId: 'the-blue-one' })).toThrow();
  });

  it('insists on knowing when it was kept', () => {
    expect(() => FavouriteSchema.parse({ ...kept, keptAt: 'yesterday' })).toThrow();
  });

  it('carries no copy of what the item is', () => {
    // A second description of an item is a second thing to disagree with the
    // library about.
    expect(Object.keys(FavouriteSchema.parse(kept))).toEqual(['mediaId', 'keptAt']);
  });
});

describe('FavouriteListSchema', () => {
  it('accepts a list of them', () => {
    expect(FavouriteListSchema.parse({ favourites: [kept] }).favourites).toHaveLength(1);
  });

  it('accepts an empty list, which is what most people start with', () => {
    expect(FavouriteListSchema.parse({ favourites: [] }).favourites).toEqual([]);
  });

  it('refuses a list that is not one', () => {
    expect(() => FavouriteListSchema.parse({ favourites: kept })).toThrow();
  });
});
