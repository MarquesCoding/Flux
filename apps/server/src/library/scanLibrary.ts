import { isMediaFile } from './readTitleFromPath';
import { resolveMetadata } from './MetadataProvider';
import { createFilenameMetadataProvider } from './createFilenameMetadataProvider';
import { readEpisodeFromPath } from './readEpisodeFromPath';
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
  /**
   * What a provider previously said this item's id was, there.
   *
   * Carried forward so a rescan can ask that provider for it directly rather
   * than searching for it again by name — the same search that risks matching
   * the wrong thing in the first place.
   */
  externalId: string | null;
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

/**
 * The filesystem as the scanner sees it.
 */
type MediaFileSystem = {
  listFiles: (root: string) => Promise<ScannedFile[]>;
};

/**
 * The library tables as the scanner sees them.
 */
type MediaStore = {
  listStored: (libraryId: string) => Promise<StoredItem[]>;
  upsert: (row: MediaRow) => Promise<void>;
  removeByPaths: (libraryId: string, paths: string[]) => Promise<number>;
  markScanned: (libraryId: string) => Promise<void>;
};

type ScanLibraryOptions = {
  libraryId: string;
  root: string;
  files: MediaFileSystem;
  store: MediaStore;
  transcoder: Transcoder;
  /**
   * Asked in order for each file's title, first answer winning.
   *
   * Defaults to the filename provider alone. Plugins prepend to this list.
   */
  providers?: MetadataProvider[];
  /**
   * Probes every file again, even one that has not changed.
   *
   * The size and modification time of a file say nothing about whether Flux
   * still reads it the same way. After a probing fix, or a plugin that names
   * files better, the only way to pick the change up is to ask again.
   */
  force?: boolean;
  /**
   * What seek previews should look like.
   *
   * Rendered here rather than when someone presses play, because a feature
   * length film takes minutes to draw and a viewer must never wait on it.
   * Omitted, no previews are drawn — which is what the tests want.
   */
  trickplay?: {
    intervalSeconds: number;
    tileWidth: number;
    columns: number;
    rows: number;
  };
  onProblem?: (path: string, reason: string) => void;
  /**
   * Told after every file, changed or not, how far the current stage is —
   * probing files, then generating trickplay and previews for what was
   * imported. Each stage counts from zero rather than continuing the last
   * one's total, since they are different work with different sizes.
   */
  onProgress?: (phase: ScanPhase, processed: number, total: number) => void;
};

const SCAN_PHASES = ['probing', 'previews'] as const;

type ScanPhase = (typeof SCAN_PHASES)[number];

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
  const storedByPath = new Map(stored.map((item) => [item.path, item]));
  const foundPaths = new Set(found.map((file) => file.path));

  const changed = found.filter((file) => {
    const existing = storedByPath.get(file.path);

    return (
      existing === undefined ||
      existing.sizeBytes !== file.sizeBytes ||
      existing.modifiedAtMs !== file.modifiedAtMs
    );
  });

  const missing = stored.map((item) => item.path).filter((path) => !foundPaths.has(path));

  return { changed, missing };
};

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
  providers = [createFilenameMetadataProvider()],
  force = false,
  trickplay,
  onProblem,
  onProgress,
}: ScanLibraryOptions): Promise<ScanResult> => {
  const found = (await files.listFiles(root)).filter((file) => isMediaFile(file.path));
  const stored = await store.listStored(libraryId);

  const { changed, missing } = force
    ? { changed: found, missing: selectChanged(found, stored).missing }
    : selectChanged(found, stored);
  const knownPaths = new Set(stored.map((item) => item.path));
  const storedByPath = new Map(stored.map((item) => [item.path, item]));

  const imported: string[] = [];
  let added = 0;
  let updated = 0;
  let failed = 0;
  let probed = 0;

  onProgress?.('probing', probed, changed.length);

  for (const file of changed) {
    try {
      const probe = await transcoder.probe(file.path);

      if (probe.video === null) {
        failed += 1;
        onProblem?.(file.path, 'No video stream.');

        continue;
      }

      const episode = readEpisodeFromPath(file.path);
      const knownExternalId = storedByPath.get(file.path)?.externalId ?? null;

      const metadata = await resolveMetadata(
        providers,
        { path: file.path, probe, episode, knownExternalId },
        (name, reason) => onProblem?.(file.path, `Metadata provider ${name} failed: ${reason}`),
      );

      if (metadata === null) {
        failed += 1;
        onProblem?.(file.path, 'No metadata provider could name this file.');

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

      imported.push(file.path);

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

  if (trickplay !== undefined) {
    let previewed = 0;

    onProgress?.('previews', previewed, imported.length);

    for (const path of imported) {
      await transcoder
        .requestTrickplay({ inputPath: path, ...trickplay, wait: true })
        .catch((error: Error) => {
          onProblem?.(path, error.message);
        });

      await transcoder.requestPreview({ inputPath: path, wait: true }).catch((error: Error) => {
        onProblem?.(path, error.message);
      });

      previewed += 1;
      onProgress?.('previews', previewed, imported.length);
    }
  }

  const removed = missing.length === 0 ? 0 : await store.removeByPaths(libraryId, missing);

  await store.markScanned(libraryId);

  return { added, updated, removed, failed };
};

export type { MediaFileSystem, MediaRow, MediaStore, ScanPhase, ScannedFile, StoredItem };

export { scanLibrary, selectChanged, SCAN_PHASES };
