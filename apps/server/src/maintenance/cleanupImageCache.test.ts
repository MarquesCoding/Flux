import { describe, expect, it } from 'vitest';
import { cleanupImageCache } from './cleanupImageCache';
import type { CacheFileSystem, MediaImageUrls } from './cleanupImageCache';

const nameFor = (url: string): string => `hash-${url}`;

const harness = (files: Record<string, string[]>) => {
  const removed: string[] = [];

  const fs: CacheFileSystem = {
    list: (directory) => Promise.resolve(files[directory] ?? []),
    remove: (path) => {
      removed.push(path);

      return Promise.resolve();
    },
  };

  return { fs, removed };
};

describe('cleanupImageCache', () => {
  it('keeps cache files a media item still references', async () => {
    const { fs, removed } = harness({
      '/cache': ['hash-a', 'hash-a.type', 'hash-orphan'],
      '/cache/profiles': [],
    });
    const media: MediaImageUrls[] = [{ posterUrl: 'a', backdropUrl: null }];

    await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve(media),
      listProfilePhotoPaths: () => Promise.resolve([]),
    });

    expect(removed).toEqual(['/cache/hash-orphan']);
  });

  it('removes both the body and the type file for an orphaned poster', async () => {
    const { fs, removed } = harness({
      '/cache': ['hash-gone', 'hash-gone.type'],
      '/cache/profiles': [],
    });

    await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve([]),
      listProfilePhotoPaths: () => Promise.resolve([]),
    });

    expect(removed.sort()).toEqual(['/cache/hash-gone', '/cache/hash-gone.type']);
  });

  it('keeps a profile photo still referenced by its stored path', async () => {
    const { fs, removed } = harness({
      '/cache': [],
      '/cache/profiles': ['abc.jpg', 'orphan.jpg'],
    });

    await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve([]),
      listProfilePhotoPaths: () => Promise.resolve(['/cache/profiles/abc.jpg']),
    });

    expect(removed).toEqual(['/cache/profiles/orphan.jpg']);
  });

  it('reports how many files it removed in total', async () => {
    const { fs } = harness({
      '/cache': ['hash-orphan'],
      '/cache/profiles': ['orphan.jpg'],
    });

    const total = await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve([]),
      listProfilePhotoPaths: () => Promise.resolve([]),
    });

    expect(total).toBe(2);
  });

  it('reports progress across each directory separately', async () => {
    const { fs } = harness({
      '/cache': ['hash-a', 'hash-b'],
      '/cache/profiles': ['only.jpg'],
    });
    const progress: [string, number, number][] = [];

    await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve([{ posterUrl: 'a', backdropUrl: 'b' }]),
      listProfilePhotoPaths: () => Promise.resolve(['/cache/profiles/only.jpg']),
      onProgress: (phase, processed, total) => progress.push([phase, processed, total]),
    });

    expect(progress).toEqual([
      ['cache', 0, 2],
      ['cache', 1, 2],
      ['cache', 2, 2],
      ['profiles', 0, 1],
      ['profiles', 1, 1],
    ]);
  });

  it('reports a problem for a file that could not be removed, rather than stopping the sweep', async () => {
    const fs: CacheFileSystem = {
      list: (directory) => Promise.resolve(directory === '/cache' ? ['hash-a', 'hash-b'] : []),
      remove: (path) =>
        path.endsWith('hash-a')
          ? Promise.reject(new Error('permission denied'))
          : Promise.resolve(),
    };
    const problems: string[] = [];

    const total = await cleanupImageCache({
      imageCacheDir: '/cache',
      profilesDir: '/cache/profiles',
      files: fs,
      nameFor,
      listMediaImageUrls: () => Promise.resolve([]),
      listProfilePhotoPaths: () => Promise.resolve([]),
      onProblem: (path, reason) => problems.push(`${path}: ${reason}`),
    });

    expect(problems).toEqual(['hash-a: permission denied']);
    expect(total).toBe(1);
  });
});
