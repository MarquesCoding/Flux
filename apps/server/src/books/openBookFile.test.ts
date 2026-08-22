import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookFormatOf, openBookFile } from './openBookFile';

const A_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

let where = '';

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'valence-open-'));
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('bookFormatOf', () => {
  it('knows a comic archive', () => {
    expect(bookFormatOf('Rent-A-Girlfriend v05.cbz')).toBe('cbz');
  });

  it('knows the older kind of comic archive', () => {
    expect(bookFormatOf('something.cbr')).toBe('cbr');
  });

  it('knows a book that reflows', () => {
    expect(bookFormatOf('Dune.epub')).toBe('epub');
  });

  it('takes a plain zip as a comic archive, which is what it usually is', () => {
    expect(bookFormatOf('pages.zip')).toBe('cbz');
  });

  it('does not mind how the name was capitalised', () => {
    expect(bookFormatOf('VOLUME.CBZ')).toBe('cbz');
  });

  it('says nothing of a film, which belongs to the other library', () => {
    expect(bookFormatOf('The Matrix.mkv')).toBeNull();
  });

  it('says nothing of a name with no extension at all', () => {
    expect(bookFormatOf('README')).toBeNull();
  });
});

describe('openBookFile', () => {
  it('opens a comic archive as pages', async () => {
    const path = join(where, 'a.cbz');

    await writeFile(path, zipSync({ 'p001.png': A_PNG, 'p002.png': A_PNG }));

    const book = await openBookFile(path);

    expect(book?.layout).toBe('fixed');
    expect(book?.layout === 'fixed' && book.pageCount).toBe(2);
  });

  it('refuses a book it has no reader for yet, rather than half-opening it', async () => {
    const path = join(where, 'a.epub');

    await writeFile(path, zipSync({ mimetype: new TextEncoder().encode('application/epub+zip') }));

    expect(await openBookFile(path)).toBeNull();
  });

  it('refuses a file that is nothing it reads', async () => {
    const path = join(where, 'a.mkv');

    await writeFile(path, 'not a book');

    expect(await openBookFile(path)).toBeNull();
  });

  it('refuses a file that claims to be a comic and is not', async () => {
    const path = join(where, 'liar.cbz');

    await writeFile(path, 'not an archive at all');

    expect(await openBookFile(path)).toBeNull();
  });
});
