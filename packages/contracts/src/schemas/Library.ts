import { z } from 'zod';
import { MediaItemSchema } from './MediaItem';
const LIBRARY_KINDS = ['movies', 'shows', 'music', 'books'] as const;

const EXTRA_KINDS = [
  'trailer',
  'behindTheScenes',
  'deletedScene',
  'featurette',
  'interview',
  'scene',
  'clip',
  'short',
  'sample',
  'other',
] as const;

const ExtraKindSchema = z.enum(EXTRA_KINDS);

const EXTRA_KIND_LABELS: Record<z.infer<typeof ExtraKindSchema>, string> = {
  trailer: 'Trailer',
  behindTheScenes: 'Behind the scenes',
  deletedScene: 'Deleted scene',
  featurette: 'Featurette',
  interview: 'Interview',
  scene: 'Scene',
  clip: 'Clip',
  short: 'Short',
  sample: 'Sample',
  other: 'Extra',
};

const SELECTABLE_LIBRARY_KINDS = ['movies', 'shows', 'books'] as const;

const LibraryKindSchema = z.enum(LIBRARY_KINDS);

const ScanResultSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

const LibrarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  kind: LibraryKindSchema,
  path: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
  lastScannedAt: z.string().datetime().nullable(),
  lastScan: ScanResultSchema.optional(),
  defaultAudioLanguage: z.string().nullable(),
  filesAtOnce: z.number().int().positive().max(16).nullable(),
});

const UpdateLibraryRequestSchema = z.object({
  defaultAudioLanguage: z.string().nullable(),
  filesAtOnce: z.number().int().positive().max(16).nullable().optional(),
});

const MediaSummarySchema = z.object({
  id: z.string().uuid(),
  libraryId: z.string().uuid(),
  title: z.string().min(1),
  year: z.number().int().min(1870).max(2200).nullable(),
  durationSeconds: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  videoCodec: z.string(),
  videoRange: z.string(),
  addedAt: z.string().datetime(),
  hasPoster: z.boolean().default(false),
  hasBackdrop: z.boolean().default(false),
  hasLogo: z.boolean().default(false),
  posterUrl: z.string().url().nullish(),
  seriesId: z.string().nullable().default(null),
  parentId: z.string().nullish(),
  extraKind: ExtraKindSchema.nullish(),
  versionLabel: z.string().nullish(),
  rating: z.number().nullish(),
  seriesTitle: z.string().nullish(),
  seasonNumber: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
  genres: z.array(z.string()).nullish(),
  externalId: z.string().nullish(),
});

const CastMemberSchema = z.object({
  personId: z.number().int().positive().nullable().default(null),
  name: z.string(),
  role: z.string(),
  imageUrl: z.string().nullable(),
});

const MediaMetadataSchema = z.object({
  overview: z.string().nullish(),
  tagline: z.string().nullish(),
  genres: z.array(z.string()).nullish(),
  cast: z.array(CastMemberSchema).nullish(),
  rating: z.number().nullish(),
  hasPoster: z.boolean(),
  hasBackdrop: z.boolean(),
  hasLogo: z.boolean(),
  seriesTitle: z.string().nullish(),
  seasonNumber: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
  externalId: z.string().nullish(),
});

const MediaDetailSchema = MediaItemSchema.extend({
  libraryId: z.string().uuid(),
  addedAt: z.string().datetime(),
  metadata: MediaMetadataSchema,
  parentId: z.string().nullish(),
  extraKind: ExtraKindSchema.nullish(),
  versionLabel: z.string().nullish(),
  extras: z.array(MediaSummarySchema).optional(),
  versions: z.array(MediaSummarySchema).optional(),
});

const MediaPageSchema = z.object({
  items: z.array(MediaSummarySchema),
  total: z.number().int().nonnegative(),
});

const LibraryFacetsSchema = z.object({
  genres: z.array(z.string()),
  decades: z.array(z.number().int()),
  maxRating: z.number().nonnegative(),
});

export type LibraryFacets = z.infer<typeof LibraryFacetsSchema>;
export type LibraryKind = z.infer<typeof LibraryKindSchema>;
export type ExtraKind = z.infer<typeof ExtraKindSchema>;
export type Library = z.infer<typeof LibrarySchema>;
export type UpdateLibraryRequest = z.infer<typeof UpdateLibraryRequestSchema>;
export type MediaSummary = z.infer<typeof MediaSummarySchema>;
export type MediaPage = z.infer<typeof MediaPageSchema>;
export type MediaDetail = z.infer<typeof MediaDetailSchema>;
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>;
export type CastMember = z.infer<typeof CastMemberSchema>;
export type ScanResult = z.infer<typeof ScanResultSchema>;

export {
  LIBRARY_KINDS,
  SELECTABLE_LIBRARY_KINDS,
  EXTRA_KINDS,
  EXTRA_KIND_LABELS,
  ExtraKindSchema,
  LibraryKindSchema,
  LibrarySchema,
  UpdateLibraryRequestSchema,
  LibraryFacetsSchema,
  MediaSummarySchema,
  MediaPageSchema,
  MediaDetailSchema,
  MediaMetadataSchema,
  CastMemberSchema,
  ScanResultSchema,
};
