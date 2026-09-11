import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFolderDisk } from './createFolderDisk';

let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'valence-folders-'));

  await mkdir(join(root, 'films'));
  await writeFile(join(root, 'notes.txt'), 'not a folder');
  await symlink(join(root, 'films'), join(root, 'linked'));
});

afterEach(async () => {
  await chmod(root, 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

describe('createFolderDisk', () => {
  it('reads the names in a folder, saying which are folders and which are links', async () => {
    const read = await createFolderDisk('darwin').readDirectory(root);

    expect(
      read.kind === 'read' ? [...read.entries].sort((a, b) => a.name.localeCompare(b.name)) : [],
    ).toEqual([
      { name: 'films', isDirectory: true, isSymbolicLink: false },
      { name: 'linked', isDirectory: false, isSymbolicLink: true },
      { name: 'notes.txt', isDirectory: false, isSymbolicLink: false },
    ]);
  });

  it('calls a folder that is not there missing', async () => {
    await expect(createFolderDisk('darwin').readDirectory(join(root, 'nowhere'))).resolves.toEqual({
      kind: 'missing',
    });
  });

  it('calls a file missing, since there is no folder there to look inside', async () => {
    await expect(
      createFolderDisk('darwin').readDirectory(join(root, 'notes.txt')),
    ).resolves.toEqual({
      kind: 'missing',
    });
  });

  it.skipIf(process.getuid?.() === 0)(
    'calls a folder it is not allowed into unreadable, which a typing mistake is not',
    async () => {
      const locked = join(root, 'locked');

      await mkdir(locked);
      await chmod(locked, 0o000);

      await expect(createFolderDisk('darwin').readDirectory(locked)).resolves.toEqual({
        kind: 'unreadable',
      });

      await chmod(locked, 0o755);
    },
  );

  it('says whether something is a folder, following a link to where it leads', async () => {
    const disk = createFolderDisk('darwin');

    await expect(disk.isDirectory(join(root, 'linked'))).resolves.toBe(true);
    await expect(disk.isDirectory(join(root, 'notes.txt'))).resolves.toBe(false);
    await expect(disk.isDirectory(join(root, 'nowhere'))).resolves.toBe(false);
  });

  it('starts from the top of the disk and the home folder anywhere but Windows', async () => {
    const roots = await createFolderDisk('linux').roots();

    expect(roots[0]).toBe('/');
    expect(roots).toContain(homedir());
    expect(new Set(roots).size).toBe(roots.length);
  });

  it('offers only drive letters on Windows', async () => {
    const roots = await createFolderDisk('win32').roots();

    for (const one of roots) {
      expect(one).toMatch(/^[A-Z]:\\$/);
    }
  });
});
