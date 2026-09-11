import { describe, expect, it } from 'vitest';
import { FolderListingSchema } from './Folder';

describe('FolderListingSchema', () => {
  it('reads a folder and what is inside it', () => {
    const parsed = FolderListingSchema.parse({
      path: '/media',
      parent: '/',
      folders: [{ name: 'films', path: '/media/films' }],
      isTruncated: false,
    });

    expect(parsed.folders[0]?.path).toBe('/media/films');
  });

  it('reads the places to start from, which are not inside any folder', () => {
    const parsed = FolderListingSchema.parse({
      path: null,
      parent: null,
      folders: [{ name: '/', path: '/' }],
      isTruncated: false,
    });

    expect(parsed.path).toBeNull();
  });

  it('refuses an answer that does not say whether it was cut short', () => {
    expect(() => FolderListingSchema.parse({ path: '/', parent: null, folders: [] })).toThrow();
  });
});
