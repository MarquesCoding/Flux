import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { MediaFileSystem, ScannedFile } from './scanLibrary'

const MAX_DEPTH = 12

/**
 * Walks a library root.
 *
 * Symlinks are not followed. A library mount is user-controlled and a symlink
 * loop, or a link pointing outside the mount, would either hang the scan or
 * pull files Flux was never given access to. Depth is capped for the same
 * reason.
 */
const walk = async (root: string, depth: number): Promise<ScannedFile[]> => {
  if (depth > MAX_DEPTH) {
    return []
  }

  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const files: ScannedFile[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue
    }

    const path = join(root, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walk(path, depth + 1)))

      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const details = await stat(path).catch(() => null)

    if (details === null) {
      continue
    }

    files.push({
      path,
      sizeBytes: details.size,
      modifiedAtMs: Math.floor(details.mtimeMs),
    })
  }

  return files
}

/**
 * The real filesystem, for the scanner.
 */
const createMediaFileSystem = (): MediaFileSystem => ({
  listFiles: (root) => walk(root, 0),
})

export default { createMediaFileSystem, MAX_DEPTH }
