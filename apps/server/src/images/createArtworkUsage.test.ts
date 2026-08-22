import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtworkUsage } from './createArtworkUsage';

const withArtwork = async (files: Record<string, number>): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'valence-artwork-'));

  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(join(directory, name), Buffer.alloc(bytes));
  }

  return directory;
};

describe('createArtworkUsage', () => {
  it('knows nothing until it has counted', () => {
    expect(createArtworkUsage({ directory: '/nowhere' }).read()).toBeNull();
  });

  it('says there is nothing rather than failing on a directory that is not there', async () => {
    const usage = await createArtworkUsage({ directory: '/nowhere-at-all' }).refresh();

    expect(usage.count).toBe(0);
    expect(usage.bytes).toBe(0);
  });

  it('adds up what the artwork costs', async () => {
    const directory = await withArtwork({ a: 100, b: 50 });

    expect((await createArtworkUsage({ directory }).refresh()).bytes).toBe(150);
  });

  it('counts posters rather than the files that describe them', async () => {
    const directory = await withArtwork({ a: 100, 'a.type': 10, b: 20, 'b.type': 10 });

    const usage = await createArtworkUsage({ directory }).refresh();

    expect(usage.count).toBe(2);
    expect(usage.bytes).toBe(140);
  });

  it('remembers the last count so a reader never waits on a disk', async () => {
    const directory = await withArtwork({ a: 10 });
    const usage = createArtworkUsage({ directory });

    await usage.refresh();

    expect(usage.read()?.bytes).toBe(10);
  });

  it('says when it looked', async () => {
    const directory = await withArtwork({ a: 1 });

    expect((await createArtworkUsage({ directory }).refresh()).atMs).toBeGreaterThan(0);
  });

  it('gives back a way to stop counting', async () => {
    const directory = await withArtwork({ a: 1 });
    const stop = createArtworkUsage({ directory, everyMs: 10 }).watch();

    expect(typeof stop).toBe('function');
    stop();
  });
});
