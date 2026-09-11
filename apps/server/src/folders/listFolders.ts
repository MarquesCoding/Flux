import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Folder, FolderListing } from '@ValenceContracts/schemas/Folder';
import type { FolderDisk } from '@ValenceServer/folders/FolderDisk';

const MAX_FOLDERS = 1000;

type FolderAnswer =
  | { kind: 'listed'; listing: FolderListing }
  | { kind: 'relative' }
  | { kind: 'missing' }
  | { kind: 'unreadable' };

/**
 * Lists the folders inside a folder on the machine running Valence — or, asked about nothing, the
 * places worth starting from — so whoever adds a library can choose where it lives rather than type
 * a path they have to remember exactly.
 *
 * Only folders are listed, since a library is a folder. A folder whose name starts with a dot is
 * left out, as every file manager does; a link that leads to a folder is followed, since a disk
 * mounted somewhere else and linked in is a common way to keep media. The path asked about must
 * start from the root, and is resolved before it is read, so `..` walks up rather than slipping past
 * whatever called this. Nothing is ever read but the names of folders.
 *
 * @param disk - How to read the disk, which a test replaces.
 * @param requested - The folder to look inside, or nothing for the places to start from.
 * @returns The folders inside it, or why they could not be listed.
 */
const listFolders = async (disk: FolderDisk, requested?: string): Promise<FolderAnswer> => {
  if (requested === undefined || requested.trim() === '') {
    const roots = await disk.roots();

    return {
      kind: 'listed',
      listing: {
        path: null,
        parent: null,
        folders: roots.map((root) => ({ name: root, path: root })),
        isTruncated: false,
      },
    };
  }

  if (!isAbsolute(requested)) {
    return { kind: 'relative' };
  }

  const at = resolve(requested);
  const read = await disk.readDirectory(at);

  if (read.kind !== 'read') {
    return read;
  }

  const checked = await Promise.all(
    read.entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry): Promise<Folder[]> => {
        const path = join(at, entry.name);
        const isFolder =
          entry.isDirectory || (entry.isSymbolicLink && (await disk.isDirectory(path)));

        return isFolder ? [{ name: entry.name, path }] : [];
      }),
  );

  const folders = checked
    .flat()
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }),
    );

  const parent = dirname(at);

  return {
    kind: 'listed',
    listing: {
      path: at,
      parent: parent === at ? null : parent,
      folders: folders.slice(0, MAX_FOLDERS),
      isTruncated: folders.length > MAX_FOLDERS,
    },
  };
};

export type { FolderAnswer };

export { listFolders, MAX_FOLDERS };
