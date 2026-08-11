import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type CachedImage = {
  body: ArrayBuffer
  contentType: string
}

type ImageFetcher = (url: string) => Promise<{
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  arrayBuffer: () => Promise<ArrayBuffer>
}>

type CreateImageCacheOptions = {
  directory: string
  fetchImpl?: ImageFetcher
  onProblem?: (url: string, reason: string) => void
}

/**
 * The largest artwork worth keeping.
 *
 * A poster is a few hundred kilobytes. Anything far past that is either not a
 * poster or not worth serving, and this stops a hostile or broken catalogue
 * filling a disk.
 */
const MAX_BYTES = 8 * 1024 * 1024

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

/**
 * A cache of artwork fetched from elsewhere.
 *
 * Artwork is proxied rather than linked for two reasons. A browser loading a
 * poster straight from a catalogue tells that catalogue what its viewer is
 * looking at, which is precisely what self-hosting is meant to avoid. And a
 * library whose covers vanish when a third party reorganises its URLs is a
 * library that has quietly rotted.
 */
const createImageCache = ({ directory, fetchImpl, onProblem }: CreateImageCacheOptions) => {
  const call: ImageFetcher = fetchImpl ?? ((url: string) => fetch(url))

  const nameFor = (url: string): string => createHash('sha256').update(url).digest('hex')

  return {
    /**
     * Reads artwork, fetching and keeping it the first time it is asked for.
     *
     * Answers with nothing rather than throwing: a missing poster should leave
     * a gap in a grid, not an error page.
     */
    read: async (url: string): Promise<CachedImage | null> => {
      const name = nameFor(url)
      const path = join(directory, name)

      try {
        const cached = await readFile(path)
        const type = await readFile(`${path}.type`, 'utf8').catch(() => 'image/jpeg')

        return {
          body: cached.buffer.slice(cached.byteOffset, cached.byteOffset + cached.byteLength),
          contentType: type,
        }
      } catch {
        // Not cached yet, which is the normal path the first time.
      }

      try {
        const response = await call(url)

        if (!response.ok) {
          onProblem?.(url, `The catalogue answered ${response.status.toString()}.`)

          return null
        }

        const contentType = response.headers.get('content-type') ?? 'image/jpeg'

        if (!IMAGE_TYPES.has(contentType.split(';')[0]?.trim() ?? '')) {
          onProblem?.(url, `That is not an image: ${contentType}.`)

          return null
        }

        const body = await response.arrayBuffer()

        if (body.byteLength > MAX_BYTES) {
          onProblem?.(url, 'That image is far larger than any artwork should be.')

          return null
        }

        await mkdir(directory, { recursive: true })
        await writeFile(path, Buffer.from(body))
        await writeFile(`${path}.type`, contentType)

        return { body, contentType }
      } catch (error) {
        onProblem?.(url, error instanceof Error ? error.message : 'Unreachable.')

        return null
      }
    },

    nameFor,
  }
}

type ImageCache = ReturnType<typeof createImageCache>

export type { CachedImage, ImageCache, ImageFetcher }

export default { createImageCache, MAX_BYTES, IMAGE_TYPES }
