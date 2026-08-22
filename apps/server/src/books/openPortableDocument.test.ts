import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openPortableDocument } from './openPortableDocument';

const A_DOCUMENT = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R>>endobj',
  '4 0 obj<</Length 20>>stream',
  '0 0 1 rg 0 0 99 99 re f',
  'endstream',
  'endobj',
  '6 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R>>endobj',
  'trailer<</Root 1 0 R>>',
].join('\n');

let where = '';

let path = '';

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'valence-pdf-'));
  path = join(where, 'a.pdf');

  await writeFile(path, A_DOCUMENT);
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('openPortableDocument', () => {
  it('counts the pages a document holds', async () => {
    expect((await openPortableDocument(path))?.pageCount).toBe(2);
  });

  it('draws a page, since a document holds instructions rather than pictures', async () => {
    const page = await (await openPortableDocument(path))?.readPage(0);

    expect(page?.contentType).toBe('image/png');

    const drawn = page ?? null;

    expect(drawn === null ? '' : Buffer.from(drawn.bytes.slice(1, 4)).toString('latin1')).toBe(
      'PNG',
    );
  });

  it('says nothing of a page past the end', async () => {
    expect(await (await openPortableDocument(path))?.readPage(9)).toBeNull();
  });

  it('says nothing of a page before the beginning', async () => {
    expect(await (await openPortableDocument(path))?.readPage(-1)).toBeNull();
  });

  it('will not open a file that is not a document', async () => {
    const wrong = join(where, 'not.pdf');

    await writeFile(wrong, 'this is not a document');

    expect(await openPortableDocument(wrong)).toBeNull();
  });

  it('will not open a file that is not there', async () => {
    expect(await openPortableDocument(join(where, 'missing.pdf'))).toBeNull();
  });
});
