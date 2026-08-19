import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createImageCache } from './createImageCache';
import type { ImageFetcher } from './createImageCache';

const POSTER = 'https://images.test/w500/poster.jpg';

const respondWith = (options: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  bytes?: number;
}) => {
  const fetchImpl = vi.fn<ImageFetcher>(() =>
    Promise.resolve({
      ok: options.ok ?? true,
      status: options.status ?? 200,
      headers: { get: () => options.contentType ?? 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(options.bytes ?? 1024)),
    }),
  );

  return fetchImpl;
};

const cache = async (fetchImpl: ImageFetcher, onProblem?: (url: string, why: string) => void) => {
  const directory = await mkdtemp(join(tmpdir(), 'flux-images-'));

  return {
    directory,
    instance: createImageCache({
      directory,
      fetchImpl,
      ...(onProblem === undefined ? {} : { onProblem }),
    }),
  };
};

describe('createImageCache', () => {
  it('fetches artwork the first time it is asked for', async () => {
    const fetchImpl = respondWith({});
    const { instance } = await cache(fetchImpl);

    const image = await instance.read(POSTER);

    expect(image?.contentType).toBe('image/jpeg');
    expect(image?.body.byteLength).toBe(1024);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps it, so the catalogue is asked once and never again', async () => {
    const fetchImpl = respondWith({});
    const { instance } = await cache(fetchImpl);

    await instance.read(POSTER);
    const second = await instance.read(POSTER);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second?.body.byteLength).toBe(1024);
  });

  it('remembers what type an image was', async () => {
    const { instance } = await cache(respondWith({ contentType: 'image/webp' }));

    await instance.read(POSTER);

    expect((await instance.read(POSTER))?.contentType).toBe('image/webp');
  });

  it('writes one file per address', async () => {
    const { instance, directory } = await cache(respondWith({}));

    await instance.read(POSTER);
    await instance.read('https://images.test/w500/other.jpg');

    const written = await readdir(directory);

    expect(written.filter((name) => !name.endsWith('.type'))).toHaveLength(2);
  });

  it('leaves a gap rather than failing when the catalogue has no such image', async () => {
    const onProblem = vi.fn();
    const { instance } = await cache(respondWith({ ok: false, status: 404 }), onProblem);

    await expect(instance.read(POSTER)).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(POSTER, expect.stringContaining('404'));
  });

  it('refuses something that is not an image', async () => {
    const onProblem = vi.fn();
    const { instance } = await cache(respondWith({ contentType: 'text/html' }), onProblem);

    await expect(instance.read(POSTER)).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(POSTER, expect.stringContaining('not an image'));
  });

  it('refuses something far larger than any poster', async () => {
    const onProblem = vi.fn();
    const { instance } = await cache(respondWith({ bytes: 20 * 1024 * 1024 }), onProblem);

    await expect(instance.read(POSTER)).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(POSTER, expect.stringContaining('larger'));
  });

  it('reports an unreachable catalogue rather than throwing', async () => {
    const onProblem = vi.fn();
    const { instance } = await cache(
      () => Promise.reject(new Error('getaddrinfo failed')),
      onProblem,
    );

    await expect(instance.read(POSTER)).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(POSTER, 'getaddrinfo failed');
  });

  it('names an address the same way every time', async () => {
    const { instance } = await cache(respondWith({}));

    expect(instance.nameFor(POSTER)).toBe(instance.nameFor(POSTER));
    expect(instance.nameFor(POSTER)).not.toBe(instance.nameFor('https://images.test/x.jpg'));
  });
});

describe('what the cache does with an answer it cannot use', () => {
  it('assumes a photograph where the catalogue names no type at all', async () => {
    const fetchImpl = vi.fn<ImageFetcher>(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      }),
    );

    const { instance } = await cache(fetchImpl);

    await expect(instance.read(POSTER)).resolves.toMatchObject({ contentType: 'image/jpeg' });
  });

  it('reads the type without the charset the catalogue tacked on', async () => {
    const fetchImpl = vi.fn<ImageFetcher>(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png; charset=binary' },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
      }),
    );

    const { instance } = await cache(fetchImpl);

    await expect(instance.read(POSTER)).resolves.not.toBeNull();
  });

  it('says so, and keeps nothing, when the catalogue cannot be reached', async () => {
    const onProblem = vi.fn();
    const fetchImpl = vi.fn<ImageFetcher>(() => Promise.reject(new Error('the network went away')));

    const { instance } = await cache(fetchImpl, onProblem);

    await expect(instance.read(POSTER)).resolves.toBeNull();
    expect(onProblem).toHaveBeenCalledWith(POSTER, 'the network went away');
  });
});
