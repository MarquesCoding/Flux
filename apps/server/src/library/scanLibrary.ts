import readTitleFromPathModule from './readTitleFromPath'
import type { MediaProbe, Transcoder } from '@FluxServer/transcoder/TranscoderClient'
import type { ScanResult } from '@FluxContracts/schemas/Library'

const { isMediaFile, readTitleFromPath } = readTitleFromPathModule

type ScannedFile = {
  path: string
  sizeBytes: number
  modifiedAtMs: number
}

type StoredItem = {
  path: string
  sizeBytes: number
  modifiedAtMs: number
}

type MediaRow = {
  libraryId: string
  path: string
  title: string
  year: number | null
  sizeBytes: number
  modifiedAtMs: number
  probe: MediaProbe
}

/**
 * The filesystem as the scanner sees it.
 */
type MediaFileSystem = {
  listFiles: (root: string) => Promise<ScannedFile[]>
}

/**
 * The library tables as the scanner sees them.
 */
type MediaStore = {
  listStored: (libraryId: string) => Promise<StoredItem[]>
  upsert: (row: MediaRow) => Promise<void>
  removeByPaths: (libraryId: string, paths: string[]) => Promise<number>
  markScanned: (libraryId: string) => Promise<void>
}

type ScanLibraryOptions = {
  libraryId: string
  root: string
  files: MediaFileSystem
  store: MediaStore
  transcoder: Transcoder
  onProblem?: (path: string, reason: string) => void
}

/**
 * Decides which files need probing.
 *
 * A file already stored at the same size and modification time is left alone.
 * Re-probing an unchanged library of thousands of files on every scan would
 * make scanning unusably slow and pointlessly spin disks.
 */
const selectChanged = (
  found: ScannedFile[],
  stored: StoredItem[],
): { changed: ScannedFile[]; missing: string[] } => {
  const storedByPath = new Map(stored.map((item) => [item.path, item]))
  const foundPaths = new Set(found.map((file) => file.path))

  const changed = found.filter((file) => {
    const existing = storedByPath.get(file.path)

    return (
      existing === undefined ||
      existing.sizeBytes !== file.sizeBytes ||
      existing.modifiedAtMs !== file.modifiedAtMs
    )
  })

  const missing = stored.map((item) => item.path).filter((path) => !foundPaths.has(path))

  return { changed, missing }
}

/**
 * Walks a library root and brings the database in line with it.
 *
 * A file that cannot be probed is counted and reported rather than aborting
 * the scan: one unreadable file in a library of thousands must not stop the
 * other thousands from appearing.
 */
const scanLibrary = async ({
  libraryId,
  root,
  files,
  store,
  transcoder,
  onProblem,
}: ScanLibraryOptions): Promise<ScanResult> => {
  const found = (await files.listFiles(root)).filter((file) => isMediaFile(file.path))
  const stored = await store.listStored(libraryId)

  const { changed, missing } = selectChanged(found, stored)
  const knownPaths = new Set(stored.map((item) => item.path))

  let added = 0
  let updated = 0
  let failed = 0

  for (const file of changed) {
    try {
      const probe = await transcoder.probe(file.path)

      if (probe.video === null) {
        failed += 1
        onProblem?.(file.path, 'No video stream.')

        continue
      }

      const { title, year } = readTitleFromPath(file.path)

      await store.upsert({
        libraryId,
        path: file.path,
        title,
        year,
        sizeBytes: file.sizeBytes,
        modifiedAtMs: file.modifiedAtMs,
        probe,
      })

      if (knownPaths.has(file.path)) {
        updated += 1
      } else {
        added += 1
      }
    } catch (error) {
      failed += 1
      onProblem?.(file.path, error instanceof Error ? error.message : 'Probe failed.')
    }
  }

  const removed = missing.length === 0 ? 0 : await store.removeByPaths(libraryId, missing)

  await store.markScanned(libraryId)

  return { added, updated, removed, failed }
}

export type { MediaFileSystem, MediaRow, MediaStore, ScannedFile, StoredItem }

export default { scanLibrary, selectChanged }
