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
 * A correction to what a file is, as the scanner needs to read it.
 */
type MediaOverride = {
  path: string;
  externalId: string;
  externalKind: 'tv' | 'movie';
};

/**
 * The library tables as the scanner sees them.
 */
type MediaStore = {
  listStored: (libraryId: string) => Promise<StoredItem[]>;
  upsert: (row: MediaRow) => Promise<void>;
  removeByPaths: (libraryId: string, paths: string[]) => Promise<number>;
  /**
   * The corrections somebody has made in this library, by path.
   *
   * Optional so that a store with no notion of them — the memory one a test
   * builds — needs no ceremony to say it has none.
   */
  listOverrides?: (libraryId: string) => Promise<MediaOverride[]>;
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
  onProblem?: (path: string, reason: string) => void;
  /**
   * Told after every file how far probing has got.
   */
  onProgress?: (phase: ScanPhase, processed: number, total: number) => void;
};

/**
 * Bringing the database in line with the filesystem is all this does.
 *
 * Previews, thumbnail sheets and intro detection used to be rendered from
 * here, for whatever a scan happened to import. That made them unreachable
 * for anything a scan did not touch — a file whose render failed once looked
 * scanned forever and was never tried again. They are their own jobs now,
 * each working from what is outstanding rather than from what was just
 * imported, and the scan job runs them in turn. See `mediaItemJob`.
 */
const SCAN_PHASES = ['probing'] as const;

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
 *
 * A correction somebody has made outranks whatever was matched before, and is
 * read on every scan rather than written once into the row — which is what
 * makes it survive both a rescan and a rebuild.
 *
 * A file the catalogue has named before is left exactly as it is when the
 * catalogue cannot be reached now. That is a network failure, not a discovery
 * that the file is nameless, and writing the filename over a catalogue's
 * answer costs the title, the artwork, and the id that lets the next scan ask
 * again cheaply — so a rescan on a bad connection would quietly strip a
 * library of everything that made it readable.
 */
const scanLibrary = async ({
  libraryId,
  root,
  files,
  store,
  transcoder,
  providers = [createFilenameMetadataProvider()],
  force = false,
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
  const overrides = new Map(
    ((await store.listOverrides?.(libraryId)) ?? []).map((one) => [one.path, one]),
  );

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

  const removed = missing.length === 0 ? 0 : await store.removeByPaths(libraryId, missing);

  await store.markScanned(libraryId);

  return { added, updated, removed, failed };
};

export type {
  MediaOverride,
  MediaFileSystem,
  MediaRow,
  MediaStore,
  ScanPhase,
  ScannedFile,
  StoredItem,
};

export { scanLibrary, selectChanged, SCAN_PHASES };
