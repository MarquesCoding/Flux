import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type CachedImage = {
  body: ArrayBuffer;
  contentType: string;
};

type ImageFetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

type CreateImageCacheOptions = {
  directory: string;
  fetchImpl?: ImageFetcher;
  onProblem?: (url: string, reason: string) => void;
};

const MAX_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * A cache of artwork fetched from elsewhere.
 */
const createImageCache = ({ directory, fetchImpl, onProblem }: CreateImageCacheOptions) => {
  const call: ImageFetcher = fetchImpl ?? ((url: string) => fetch(url));

  const nameFor = (url: string): string => createHash('sha256').update(url).digest('hex');

  return {
    read: async (url: string): Promise<CachedImage | null> => {
      const name = nameFor(url);
      const path = join(directory, name);

      try {
        const cached = await readFile(path);
        const type = await readFile(`${path}.type`, 'utf8').catch(() => 'image/jpeg');

        return {
          body: cached.buffer.slice(cached.byteOffset, cached.byteOffset + cached.byteLength),
          contentType: type,
        };
      } catch {}

      try {
        const response = await call(url);

        if (!response.ok) {
          onProblem?.(url, `The catalogue answered ${response.status.toString()}.`);

          return null;
        }

        const contentType = response.headers.get('content-type') ?? 'image/jpeg';

        if (!IMAGE_TYPES.has(contentType.split(';')[0]?.trim() ?? '')) {
          onProblem?.(url, `That is not an image: ${contentType}.`);

          return null;
        }

        const body = await response.arrayBuffer();

        if (body.byteLength > MAX_BYTES) {
          onProblem?.(url, 'That image is far larger than any artwork should be.');

          return null;
        }

        await mkdir(directory, { recursive: true });
        await writeFile(path, Buffer.from(body));
        await writeFile(`${path}.type`, contentType);

        return { body, contentType };
      } catch (error) {
        onProblem?.(url, error instanceof Error ? error.message : 'Unreachable.');

        return null;
      }
    },

    nameFor,
  };
};

export type { ImageFetcher };

export { createImageCache };
