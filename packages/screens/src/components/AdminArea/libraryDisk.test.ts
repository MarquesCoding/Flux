import { describe, expect, it } from 'vitest';
import { libraryDisk } from './libraryDisk';
import type { DiskUse } from './libraryDisk';

const disk = (mountPoint: string, totalBytes: number, availableBytes: number): DiskUse => ({
  mountPoint,
  totalBytes,
  availableBytes,
});

const root = disk('/', 500, 250);
const media = disk('/media', 8000, 4000);
const archive = disk('/media/archive', 2000, 100);

describe('libraryDisk', () => {
  it('has nothing to report before any reading', () => {
    expect(libraryDisk([], ['/media/films'])).toBeNull();
  });

  it('has nothing to report for a server with no libraries', () => {
    expect(libraryDisk([root, media], [])).toBeNull();
  });

  it('finds the filesystem a library is written to', () => {
    expect(libraryDisk([root, media], ['/media/films'])).toBe(media);
  });

  it('takes the deepest mount, not the first one the path is under', () => {
    expect(libraryDisk([root, media, archive], ['/media/archive/films'])).toBe(archive);
  });

  it('falls back to the root when nothing more specific holds the path', () => {
    expect(libraryDisk([root, media], ['/srv/films'])).toBe(root);
  });

  it('does not mistake a mount for one whose name it merely starts', () => {
    expect(libraryDisk([root, disk('/media', 8000, 4000)], ['/mediatemp/films'])).toBe(root);
  });

  it('reports the library disk with the least left, which is the one that stops first', () => {
    expect(libraryDisk([root, media, archive], ['/media/films', '/media/archive/shows'])).toBe(
      archive,
    );
  });

  it('reports a library sitting on the mount point itself', () => {
    expect(libraryDisk([root, media], ['/media'])).toBe(media);
  });

  it('places nothing when no mount holds the path at all', () => {
    expect(libraryDisk([media], ['/srv/films'])).toBeNull();
  });
});
