import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openComicRar } from './openComicRar';

let where = '';

beforeAll(async () => {
  where = await mkdtemp(join(tmpdir(), 'valence-rar-'));
});

afterAll(async () => {
  await rm(where, { recursive: true, force: true });
});

describe('openComicRar', () => {
  it('will not open a file that is not an archive', async () => {
    const path = join(where, 'not.cbr');

    await writeFile(path, 'this is not a RAR');

    expect(await openComicRar(path)).toBeNull();
  });

  it('will not open a file that is only pretending, signature and all', async () => {
    const path = join(where, 'pretend.cbr');

    await writeFile(path, Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00, 0, 0, 0]));

    expect(await openComicRar(path)).toBeNull();
  });

  it('will not open a file that is not there', async () => {
    expect(await openComicRar(join(where, 'missing.cbr'))).toBeNull();
  });
});
