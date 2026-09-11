import { describe, expect, it } from 'vitest';
import { listFolders, MAX_FOLDERS } from './listFolders';
import type { DirectoryRead, FolderDisk, FolderEntry } from '@ValenceServer/folders/FolderDisk';

const folder = (name: string): FolderEntry => ({ name, isDirectory: true, isSymbolicLink: false });

const file = (name: string): FolderEntry => ({ name, isDirectory: false, isSymbolicLink: false });

const link = (name: string): FolderEntry => ({ name, isDirectory: false, isSymbolicLink: true });

const diskWith = (
  tree: Record<string, DirectoryRead>,
  linkedFolders: string[] = [],
  roots: string[] = ['/', '/home/valence'],
): FolderDisk => ({
  readDirectory: (path) => Promise.resolve(tree[path] ?? { kind: 'missing' }),
  isDirectory: (path) => Promise.resolve(linkedFolders.includes(path)),
  roots: () => Promise.resolve(roots),
});

describe('listFolders', () => {
  it('offers the places to start from when no folder is named', async () => {
    const found = await listFolders(diskWith({}));

    expect(found).toEqual({
      kind: 'listed',
      listing: {
        path: null,
        parent: null,
        folders: [
          { name: '/', path: '/' },
          { name: '/home/valence', path: '/home/valence' },
        ],
        isTruncated: false,
      },
    });
  });

  it('treats a blank path as no path at all', async () => {
    const found = await listFolders(diskWith({}), '   ');

    expect(found.kind === 'listed' ? found.listing.path : 'not listed').toBeNull();
  });

  it('lists only the folders, in the order a person would sort them', async () => {
    const found = await listFolders(
      diskWith({
        '/media': {
          kind: 'read',
          entries: [folder('Season 10'), file('notes.txt'), folder('season 2'), folder('Films')],
        },
      }),
      '/media',
    );

    expect(found.kind === 'listed' ? found.listing.folders.map((one) => one.name) : []).toEqual([
      'Films',
      'season 2',
      'Season 10',
    ]);
  });

  it('leaves out folders whose names start with a dot', async () => {
    const found = await listFolders(
      diskWith({ '/media': { kind: 'read', entries: [folder('.cache'), folder('films')] } }),
      '/media',
    );

    expect(found.kind === 'listed' ? found.listing.folders : []).toEqual([
      { name: 'films', path: '/media/films' },
    ]);
  });

  it('follows a link that leads to a folder, but not one that leads to a file', async () => {
    const found = await listFolders(
      diskWith({ '/media': { kind: 'read', entries: [link('usb-drive'), link('latest.mkv')] } }, [
        '/media/usb-drive',
      ]),
      '/media',
    );

    expect(found.kind === 'listed' ? found.listing.folders.map((one) => one.name) : []).toEqual([
      'usb-drive',
    ]);
  });

  it('says which folder holds this one, and that the top of the disk is held by none', async () => {
    const disk = diskWith({
      '/media': { kind: 'read', entries: [] },
      '/': { kind: 'read', entries: [] },
    });

    const media = await listFolders(disk, '/media');
    const top = await listFolders(disk, '/');

    expect(media.kind === 'listed' ? media.listing.parent : 'not listed').toBe('/');
    expect(top.kind === 'listed' ? top.listing.parent : 'not listed').toBeNull();
  });

  it('walks up a path that climbs, rather than reading it as written', async () => {
    const found = await listFolders(
      diskWith({ '/media': { kind: 'read', entries: [folder('films')] } }),
      '/media/films/..',
    );

    expect(found.kind === 'listed' ? found.listing.path : 'not listed').toBe('/media');
  });

  it('refuses a path that does not start from the root', async () => {
    await expect(listFolders(diskWith({}), 'media/films')).resolves.toEqual({ kind: 'relative' });
  });

  it('says a folder that is not there is missing', async () => {
    await expect(listFolders(diskWith({}), '/nowhere')).resolves.toEqual({ kind: 'missing' });
  });

  it('says a folder it may not read is unreadable, rather than empty', async () => {
    await expect(
      listFolders(diskWith({ '/root': { kind: 'unreadable' } }), '/root'),
    ).resolves.toEqual({ kind: 'unreadable' });
  });

  it('stops at a thousand folders and says it stopped', async () => {
    const many = Array.from({ length: MAX_FOLDERS + 5 }, (_, at) =>
      folder(`folder ${at.toString()}`),
    );

    const found = await listFolders(
      diskWith({ '/media': { kind: 'read', entries: many } }),
      '/media',
    );

    expect(found.kind === 'listed' ? found.listing.folders : []).toHaveLength(MAX_FOLDERS);
    expect(found.kind === 'listed' ? found.listing.isTruncated : false).toBe(true);
  });
});
