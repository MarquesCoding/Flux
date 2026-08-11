import { describe, expect, it } from 'vitest';
import { createMemoryFavouriteService } from './createMemoryFavouriteService';

describe('createMemoryFavouriteService', () => {
  it('answers with nothing for somebody who has kept nothing', async () => {
    const favourites = createMemoryFavouriteService();

    await expect(favourites.list('profile-1')).resolves.toEqual([]);
  });

  it('keeps what it is told to keep', async () => {
    const favourites = createMemoryFavouriteService();

    await favourites.keep('profile-1', 'media-1');

    await expect(favourites.list('profile-1')).resolves.toMatchObject([{ mediaId: 'media-1' }]);
  });

  it('treats keeping something twice as keeping it once', async () => {
    const favourites = createMemoryFavouriteService();

    await favourites.keep('profile-1', 'media-1');
    await favourites.keep('profile-1', 'media-1');

    await expect(favourites.list('profile-1')).resolves.toHaveLength(1);
  });

  it('stops keeping something on request', async () => {
    const favourites = createMemoryFavouriteService();

    await favourites.keep('profile-1', 'media-1');
    await favourites.drop('profile-1', 'media-1');

    await expect(favourites.list('profile-1')).resolves.toEqual([]);
  });

  it('says nothing about somebody who never kept it', async () => {
    const favourites = createMemoryFavouriteService();

    await favourites.drop('profile-1', 'media-1');

    await expect(favourites.list('profile-1')).resolves.toEqual([]);
  });

  it('keeps one household member apart from another', async () => {
    const favourites = createMemoryFavouriteService();

    await favourites.keep('profile-1', 'media-1');

    await expect(favourites.list('profile-2')).resolves.toEqual([]);
  });
});
