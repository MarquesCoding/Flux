import { isMediaFile } from './readTitleFromPath';
import { resolveMetadata } from './MetadataProvider';
import { createFilenameMetadataProvider } from './createFilenameMetadataProvider';
import { readEpisodeFromPath } from './readEpisodeFromPath';
import { groupBareNumberedEpisodes } from './groupBareNumberedEpisodes';
import type { Metadata, MetadataProvider } from './MetadataProvider';
import type { EpisodeNumbering } from './readEpisodeFromPath';
import type { MediaProbe, Transcoder } from '@FluxServer/transcoder/TranscoderClient';
import type { ScanResult } from '@FluxContracts/schemas/Library';

type ScannedFile = {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
};

type StoredItem = {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
  externalId: string | null;
  videoBitDepth: number | null;
  canCopySegments: boolean | null;
};

type MediaRow = {
  libraryId: string;
  path: string;
  title: string;
  year: number | null;
  sizeBytes: number;
  modifiedAtMs: number;
  probe: MediaProbe;
  metadata: Metadata;
  episode: EpisodeNumbering;
};

type MediaFileSystem = {
  listFiles: (root: string) => Promise<ScannedFile[]>;
};

type MediaOverride = {
  path: string;
  externalId: string;
  externalKind: 'tv' | 'movie';
};

type MediaStore = {
  listStored: (libraryId: string) => Promise<StoredItem[]>;
  upsert: (row: MediaRow) => Promise<void>;
  removeByPaths: (libraryId: string, paths: string[]) => Promise<number>;
  listOverrides?: (libraryId: string) => Promise<MediaOverride[]>;
  markScanned: (libraryId: string) => Promise<void>;
};

type ScanLibraryOptions = {
  libraryId: string;
  root: string;
  files: MediaFileSystem;
  store: MediaStore;
  transcoder: Transcoder;
  providers?: MetadataProvider[];
  force?: boolean;
  isPartial?: boolean;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (phase: ScanPhase, processed: number, total: number) => void;
  isCancelled?: () => boolean;
};

type ScanPhase = 'probing';

/**
 * Decides which files need probing.
 */
const selectChanged = (
  found: ScannedFile[],
  stored: StoredItem[],
): { changed: ScannedFile[]; missing: string[] } => {
  const storedByPath = new Map(stored.map((item) => [item.path, item]));
  const foundPaths = new Set(found.map((file) => file.path));

  const changed = found.filter((file) => {
    const existing = storedByPath.get(file.path);

    return (
      existing === undefined ||
      existing.sizeBytes !== file.sizeBytes ||
      existing.modifiedAtMs !== file.modifiedAtMs ||
      existing.videoBitDepth === null ||
      existing.canCopySegments === null
    );
  });

  const missing = stored.map((item) => item.path).filter((path) => !foundPaths.has(path));

  return { changed, missing };
};

/**
 * Walks a library root and brings the database in line with it.
 */
const scanLibrary = async ({
  libraryId,
  root,
  files,
  store,
  transcoder,
  providers = [createFilenameMetadataProvider()],
  force = false,
  isPartial = false,
  onProblem,
  onProgress,
  isCancelled,
}: ScanLibraryOptions): Promise<ScanResult> => {
  const found = (await files.listFiles(root)).filter((file) => isMediaFile(file.path));
  const stored = await store.listStored(libraryId);

  const bareNumbered = groupBareNumberedEpisodes(found.map((file) => file.path));

  const seen = force
    ? { changed: found, missing: selectChanged(found, stored).missing }
    : selectChanged(found, stored);
  const { changed } = seen;

  const hasVanished = found.length === 0 && stored.length > 0;
  const missing = isPartial || hasVanished ? [] : seen.missing;
  const knownPaths = new Set(stored.map((item) => item.path));
  const storedByPath = new Map(stored.map((item) => [item.path, item]));
  const overrides = new Map(
    ((await store.listOverrides?.(libraryId)) ?? []).map((one) => [one.path, one]),
  );

  let added = 0;
  let updated = 0;
  let failed = 0;
  let probed = 0;

  onProgress?.('probing', probed, changed.length);

  let wasStopped = false;

  for (const file of changed) {
    if (isCancelled?.() === true) {
      wasStopped = true;

      break;
    }

    try {
      const probe = await transcoder.probe(file.path);

      if (probe.video === null) {
        failed += 1;
        onProblem?.(file.path, 'No video stream.');

        continue;
      }

      const read = readEpisodeFromPath(file.path);
      const bare = bareNumbered.get(file.path);

      const episode =
        read.episodeNumber === null && bare !== undefined
          ? { ...read, ...bare, seriesYear: read.seriesYear }
          : read;
      const corrected = overrides.get(file.path) ?? null;
      const knownExternalId =
        corrected?.externalId ?? storedByPath.get(file.path)?.externalId ?? null;

      const metadata = await resolveMetadata(
        providers,
        {
          path: file.path,
          probe,
          episode,
          knownExternalId,
          ...(corrected === null ? {} : { knownExternalKind: corrected.externalKind }),
        },
        (name, reason) => onProblem?.(file.path, `Metadata provider ${name} failed: ${reason}`),
      );

      if (metadata === null) {
        failed += 1;
        onProblem?.(file.path, 'No metadata provider could name this file.');

        continue;
      }

      if (knownExternalId !== null && (metadata.externalId ?? null) === null) {
        failed += 1;
        onProblem?.(
          file.path,
          'The catalogue did not answer. Keeping what was already known about this file.',
        );

        continue;
      }

      const { title, year } = metadata;

      await store.upsert({
        libraryId,
        path: file.path,
        title,
        year,
        sizeBytes: file.sizeBytes,
        modifiedAtMs: file.modifiedAtMs,
        probe,
        metadata,
        episode,
      });

      if (knownPaths.has(file.path)) {
        updated += 1;
      } else {
        added += 1;
      }
    } catch (error) {
      failed += 1;
      onProblem?.(file.path, error instanceof Error ? error.message : 'Probe failed.');
    } finally {
      probed += 1;
      onProgress?.('probing', probed, changed.length);
    }
  }

  if (hasVanished) {
    onProblem?.(
      root,
      'Nothing was found where this library reads from, so what it already held has been left alone. Check the folder is still there — a network share that is not mounted looks exactly like an empty one.',
    );
  }

  if (wasStopped) {
    onProblem?.(
      root,
      'This scan was stopped before it finished. What it had already read is kept; nothing was deleted, and the library still counts as unscanned.',
    );

    return { added, updated, removed: 0, failed };
  }

  const removed = missing.length === 0 ? 0 : await store.removeByPaths(libraryId, missing);

  await store.markScanned(libraryId);

  return { added, updated, removed, failed };
};

export type { MediaFileSystem, MediaRow, MediaStore, ScanPhase, ScannedFile, StoredItem };

export { scanLibrary, selectChanged };
