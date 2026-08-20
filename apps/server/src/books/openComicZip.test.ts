import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openComicZip } from './openComicZip';

const A_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const A_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

let where = '';

const anArchive = async (name: string, files: Record<string, Uint8Array>): Promise<string> => {
  const path = join(where, name);

  await writeFile(path, zipSync(files));

  return path;
};

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'flux-books-'));
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('openComicZip', () => {
  it('counts the pages without unpacking them', async () => {
    const path = await anArchive('three.cbz', {
      'p001.png': A_PNG,
      'p002.png': A_PNG,
      'p003.png': A_PNG,
    });

    expect((await openComicZip(path))?.pageCount).toBe(3);
  });

  it('reads a page, and says what kind of picture it is', async () => {
    const path = await anArchive('mixed.cbz', { 'p000.jpg': A_JPEG, 'p001.png': A_PNG });

    const page = await (await openComicZip(path))?.readPage(0);

    expect(page?.contentType).toBe('image/jpeg');
    expect(page?.bytes).toEqual(A_JPEG);
  });

  it('reads them in the order somebody turns them, not the order they were written', async () => {
    const path = await anArchive('shuffled.cbz', {
      'p010.png': new Uint8Array([...A_PNG, 10]),
      'p002.png': new Uint8Array([...A_PNG, 2]),
      'p001.png': new Uint8Array([...A_PNG, 1]),
    });

    const book = await openComicZip(path);

    expect((await book?.readPage(0))?.bytes.at(-1)).toBe(1);
    expect((await book?.readPage(2))?.bytes.at(-1)).toBe(10);
  });

  it('leaves out what is in the archive but is not a page', async () => {
    const path = await anArchive('noted.cbz', {
      'ComicInfo.xml': new TextEncoder().encode('<ComicInfo />'),
      'p001.png': A_PNG,
    });

    expect((await openComicZip(path))?.pageCount).toBe(1);
  });

  it('says nothing of a page past the end, rather than pretending there is one', async () => {
    const path = await anArchive('short.cbz', { 'p001.png': A_PNG });

    expect(await (await openComicZip(path))?.readPage(4)).toBeNull();
  });

  it('will not open a file that is not an archive', async () => {
    const path = join(where, 'not.cbz');

    await writeFile(path, 'this is not a zip');

    expect(await openComicZip(path)).toBeNull();
  });

  it('will not open an archive with no pages in it', async () => {
    const path = await anArchive('empty.cbz', {
      'ComicInfo.xml': new TextEncoder().encode('<ComicInfo />'),
    });

    expect(await openComicZip(path)).toBeNull();
  });

  it('will not open a file that is not there', async () => {
    expect(await openComicZip(join(where, 'missing.cbz'))).toBeNull();
  });
});
