import { isMediaFile } from './readTitleFromPath';
import { resolveMetadata } from './MetadataProvider';
import { createFilenameMetadataProvider } from './createFilenameMetadataProvider';
import { describeQuality } from './describeQuality';
import { readEpisodeFromPath, tidy } from './readEpisodeFromPath';
import { groupBareNumberedEpisodes } from './groupBareNumberedEpisodes';
import { groupExtras } from './groupExtras';
import { groupVersions } from './groupVersions';
import { mapWithLimit } from '@ValenceCore/functions/mapWithLimit';
import type { Metadata, MetadataProvider } from './MetadataProvider';
import type { EpisodeNumbering } from './readEpisodeFromPath';
import type { MediaProbe, Transcoder } from '@ValenceServer/transcoder/TranscoderClient';
import type { ExtraKind, ScanResult } from '@ValenceContracts/schemas/Library';

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
  videoRangeBase: string | null;
  canCopySegments: boolean | null;
  videoFrameRate: number | null;
  probeVersion: number | null;
};

type MediaRow = {
  libraryId: string;
  path: string;
  title: string;
  year: number | null;
  sizeBytes: number;
  modifiedAtMs: number;
  probe: MediaProbe;
  probeVersion: number | null;
  metadata: Metadata;
  episode: EpisodeNumbering;
  extraKind: ExtraKind | null;
  versionLabel: string | null;
};

type MediaFileSystem = {
  listFiles: (root: string) => Promise<ScannedFile[]>;
};

type MediaOverride = {
  path: string;
  externalId: string;
  externalKind: 'tv' | 'movie';
};

type ScannedItem = {
  itemId: string;
  title: string;
  seriesTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  durationSeconds: number | null;
  genres: string[];
  rating: number | null;
  quality: string | null;
};

type MediaStore = {
  listStored: (libraryId: string) => Promise<StoredItem[]>;
  upsert: (row: MediaRow) => Promise<string | null>;
  removeByPaths: (libraryId: string, paths: string[]) => Promise<ScannedItem[]>;
  listOverrides?: (libraryId: string) => Promise<MediaOverride[]>;
  linkExtras?: (libraryId: string, links: { path: string; parentPath: string }[]) => Promise<void>;
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
  atOnce?: number;
  onProblem?: (path: string, reason: string) => void;
  onProgress?: (phase: ScanPhase, processed: number, total: number) => void;
  onAdded?: (item: ScannedItem) => void;
  onRemoved?: (items: ScannedItem[]) => void;
  isCancelled?: () => boolean;
};

type ScanPhase = 'probing';

/**
 * Decides which of a library's files actually need probing: the ones that are new, and the ones
 * whose size or modification time has moved since they were last read. Probing launches a process
 * per file, so a library of twenty thousand that has gained two should cost two probes.
 *
 * @param found - Every file on disk now.
 * @param stored - What the database holds about them.
 * @param probeVersion - Which version of the probing rules this build applies, so a row worked out
 *   under an older one is worked out again. Nothing to compare against where it is not known, since
 *   a transcoder that could not be asked is a reason to leave the library alone rather than to
 *   probe all of it.
 * @returns The files to probe.
 */
const selectChanged = (
  found: ScannedFile[],
  stored: StoredItem[],
  probeVersion: number | null = null,
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
      existing.videoRangeBase === null ||
      existing.canCopySegments === null ||
      existing.videoFrameRate === null ||
      (probeVersion !== null && existing.probeVersion !== probeVersion)
    );
  });

  const missing = stored.map((item) => item.path).filter((path) => !foundPaths.has(path));

  return { changed, missing };
};

/**
 * Walks a library root and brings the database in line with what is actually there: probing what is
 * new or changed, asking the metadata providers about each, and removing rows for files that have
 * gone. Reports its progress as it goes, since a first scan of a real library takes minutes.
 *
 * @param options - Where to walk, what to write to, who to ask about files, how many to work on at
 *   once, and where to report progress and problems.
 * @returns What the scan changed, counted.
 */
/**
 * Asks the transcoder which version of its probing rules this build applies.
 *
 * Answers nothing where it cannot be reached, which leaves every stored row alone. The alternative
 * — treating an unreachable transcoder as a version mismatch — would reprobe an entire library
 * because a container was restarting.
 *
 * @param transcoder - The transcoder to ask.
 * @returns The version, or nothing if it could not be had.
 */
const readProbeVersion = async (transcoder: Transcoder): Promise<number | null> => {
  try {
    return (await transcoder.capabilities()).probeVersion;
  } catch {
    return null;
  }
};

const scanLibrary = async ({
  libraryId,
  root,
  files,
  store,
  transcoder,
  providers = [createFilenameMetadataProvider()],
  force = false,
  isPartial = false,
  atOnce = 1,
  onProblem,
  onProgress,
  onAdded,
  onRemoved,
  isCancelled,
}: ScanLibraryOptions): Promise<ScanResult> => {
  const found = (await files.listFiles(root)).filter((file) => isMediaFile(file.path));
  const stored = await store.listStored(libraryId);
  const probeVersion = await readProbeVersion(transcoder);

  const bareNumbered = groupBareNumberedEpisodes(found.map((file) => file.path));
  const extras = groupExtras(found.map((file) => file.path));
  const versions = groupVersions(
    found.map((file) => file.path),
    new Set(extras.keys()),
  );

  const seen = force
    ? { changed: found, missing: selectChanged(found, stored, probeVersion).missing }
    : selectChanged(found, stored, probeVersion);
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

  await mapWithLimit(changed, atOnce, async (file) => {
    if (isCancelled?.() === true) {
      return;
    }

    try {
      const probe = await transcoder.probe(file.path);

      if (probe.video === null) {
        failed += 1;
        onProblem?.(file.path, 'No video stream.');

        return;
      }

      const read = readEpisodeFromPath(file.path);
      const bare = bareNumbered.get(file.path);
      const extra = extras.get(file.path) ?? null;

      const numbered =
        read.episodeNumber === null && bare !== undefined
          ? { ...read, ...bare, seriesYear: read.seriesYear }
          : read;

      const episode =
        extra?.seriesFolder === null || extra === null
          ? numbered
          : {
              ...numbered,
              seriesTitle: tidy(extra.seriesFolder.slice(extra.seriesFolder.lastIndexOf('/') + 1)),
              seriesFolder: extra.seriesFolder,
            };
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

        return;
      }

      if (knownExternalId !== null && (metadata.externalId ?? null) === null) {
        failed += 1;
        onProblem?.(
          file.path,
          'The catalogue did not answer. Keeping what was already known about this file.',
        );

        return;
      }

      const { title, year } = metadata;

      const itemId = await store.upsert({
        libraryId,
        path: file.path,
        title,
        year,
        sizeBytes: file.sizeBytes,
        modifiedAtMs: file.modifiedAtMs,
        probe,
        probeVersion,
        metadata,
        episode,
        extraKind: extra?.kind ?? null,
        versionLabel: versions.get(file.path)?.label ?? null,
      });

      if (knownPaths.has(file.path)) {
        updated += 1;
      } else {
        added += 1;

        if (itemId !== null && extra === null && !versions.has(file.path)) {
          onAdded?.({
            itemId,
            title,
            seriesTitle: episode.seriesTitle ?? null,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            year,
            posterUrl: metadata.posterUrl ?? null,
            overview: metadata.overview ?? null,
            durationSeconds: probe.durationSeconds,
            genres: metadata.genres ?? [],
            rating: metadata.rating ?? null,
            quality: describeQuality(probe.video.width, probe.video.height, probe.video.range),
          });
        }
      }
    } catch (error) {
      failed += 1;
      onProblem?.(file.path, error instanceof Error ? error.message : 'Probe failed.');
    } finally {
      probed += 1;
      onProgress?.('probing', probed, changed.length);
    }
  });

  if (hasVanished) {
    onProblem?.(
      root,
      'Nothing was found where this library reads from, so what it already held has been left alone. Check the folder is still there — a network share that is not mounted looks exactly like an empty one.',
    );
  }

  if (isCancelled?.() === true) {
    onProblem?.(
      root,
      'This scan was stopped before it finished. What it had already read is kept; nothing was deleted, and the library still counts as unscanned.',
    );

    return { added, updated, removed: 0, failed };
  }

  const links = [
    ...[...extras]
      .map(([path, one]) => ({ path, parentPath: one.parentPath }))
      .filter((one): one is { path: string; parentPath: string } => one.parentPath !== null),
    ...[...versions].map(([path, one]) => ({ path, parentPath: one.parentPath })),
  ];

  if (links.length > 0) {
    await store.linkExtras?.(libraryId, links);
  }

  const gone = missing.length === 0 ? [] : await store.removeByPaths(libraryId, missing);

  if (gone.length > 0) {
    onRemoved?.(gone);
  }

  await store.markScanned(libraryId);

  return { added, updated, removed: gone.length, failed };
};

export type {
  MediaFileSystem,
  MediaRow,
  MediaStore,
  ScanPhase,
  ScannedFile,
  ScannedItem,
  StoredItem,
};

export { scanLibrary, selectChanged };
