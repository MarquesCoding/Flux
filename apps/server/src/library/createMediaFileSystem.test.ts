import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMediaFileSystem } from './createMediaFileSystem';

const REAL = 'a real film';

const ACTUAL = 'a film somewhere else entirely';

let where = '';

let root = '';

const namesUnder = async (): Promise<string[]> => {
  const found = await createMediaFileSystem().listFiles(root);

  return found.map((file) => file.path.slice(root.length + 1)).sort();
};

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'valence-walk-'));
  root = join(where, 'library');

  await mkdir(root, { recursive: true });
  await mkdir(join(where, 'outside', 'more'), { recursive: true });

  await writeFile(join(root, 'Real.mkv'), REAL);
  await writeFile(join(where, 'outside', 'Actual.mkv'), ACTUAL);
  await writeFile(join(where, 'outside', 'more', 'Deeper.mkv'), REAL);

  await symlink(join('..', 'outside', 'Actual.mkv'), join(root, 'Linked.mkv'));
  await symlink(join('..', 'outside', 'more'), join(root, 'shelf'));
  await symlink(join('.', 'nowhere.mkv'), join(root, 'Broken.mkv'));
  await symlink(join('..', 'library'), join(root, 'loop'));
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('createMediaFileSystem', () => {
  it('finds a file that is really there', async () => {
    expect(await namesUnder()).toContain('Real.mkv');
  });

  it('finds a file reached through a link, which is how plenty of libraries are assembled', async () => {
    expect(await namesUnder()).toContain('Linked.mkv');
  });

  it('reads the size of what a link points at rather than the size of the link', async () => {
    const found = await createMediaFileSystem().listFiles(root);
    const linked = found.find((file) => file.path.endsWith('Linked.mkv'));

    expect(linked?.sizeBytes).toBe(ACTUAL.length);
  });

  it('walks a directory reached through a link', async () => {
    expect(await namesUnder()).toContain(join('shelf', 'Deeper.mkv'));
  });

  it('keeps going past a link pointing at nothing, rather than losing the library to it', async () => {
    const names = await namesUnder();

    expect(names).not.toContain('Broken.mkv');
    expect(names).toContain('Real.mkv');
  });

  it('follows a link back to where it started once, and reports nothing twice over', async () => {
    const names = await namesUnder();

    expect(names.filter((name) => name === 'Real.mkv')).toHaveLength(1);
    expect(names).toEqual(['Linked.mkv', 'Real.mkv', join('shelf', 'Deeper.mkv')]);
  });
});
