import { z } from 'zod';
import { MediaItemSchema } from './MediaItem';
/**
 * The library kinds, as a tuple.
 *
 * Exported separately so route definitions can build their own schema with
 * the OpenAPI-extended `z` while still deriving the values from one place.
 * Mixing zod instances between packages breaks request type inference.
 */
const LIBRARY_KINDS = ['movies', 'shows', 'music'] as const;

const LibraryKindSchema = z.enum(LIBRARY_KINDS);

/**
 * What a scan did, counted.
 *
 * `failed` is the files a scan could not read at all — unreadable, or a probe
 * that errored — and is kept apart from the rest because it is the count that
 * means something is wrong with the media rather than with the library.
 */
const ScanResultSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

/**
 * A root the scanner walks.
 *
 * `path` is a location inside the read-only media mount. Flux never writes
 * there, so a library is a view over the operator's files rather than a
 * container Flux owns. See ADR-0006.
 *
 * `filesAtOnce` is how many of its files may be rendered at the same time,
 * and null leaves it to the server. The server sizes itself to the processors
 * it has, which is right for a library on a local disk, where four at once
 * costs nothing and four cores do four times the work. A library on a network
 * share is the opposite case: the files arrive down one wire, and asking for
 * four divides that wire four ways while adding seeking to it. Measured on a
 * Wi-Fi SMB share, one at a time read roughly ten times faster per file than
 * four did.
 *
 * `lastScan` sits beside `lastScannedAt` because "scanned an hour ago" and
 * "scanned an hour ago and removed two hundred items" answer the same
 * question, and only the second tells somebody their mount was missing. A
 * scan that changed nothing and a scan that emptied a library are otherwise
 * indistinguishable from the outside. It is absent rather than nullable, and
 * the difference is meant: a library last scanned by a version that did not
 * keep count has no record, which is not the same as a scan that counted zero
 * of everything.
 */
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

/**
 * The library settings a dialog can change after creation.
 */
const UpdateLibraryRequestSchema = z.object({
  defaultAudioLanguage: z.string().nullable(),
  filesAtOnce: z.number().int().positive().max(16).nullable().optional(),
});

/**
 * Enough of an item to draw it in a grid.
 *
 * Deliberately small: a library of tens of thousands of items should not ship
 * every stream's details to render a page of posters.
 *
 * `seriesId` says which programme an episode belongs to, and is the programme's
 * own id rather than its title. Two programmes share a title — The Office,
 * Shameless, and every remake — so anything that gathers, hides or rates "the
 * series" needs something a title cannot give it. Null for a film, which is not
 * a series of one.
 */
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
  seriesId: z.string().nullable().default(null),
  rating: z.number().nullish(),
  seriesTitle: z.string().nullish(),
  seasonNumber: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
  genres: z.array(z.string()).nullish(),
});

/**
 * Everything about an item, including the streams the negotiator needs.
 *
 * Structurally a superset of `MediaItem`, so it can be handed to
 * `negotiatePlayback` without conversion.
 */
const CastMemberSchema = z.object({
  name: z.string(),
  role: z.string(),
  imageUrl: z.string().nullable(),
});

/**
 * What a catalogue knows about an item, when one has been consulted.
 *
 * Every field is optional because the built-in provider reads filenames and
 * knows none of them. A viewer sees what is actually known rather than a page
 * of empty labels.
 */
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
});

const MediaDetailSchema = MediaItemSchema.extend({
  libraryId: z.string().uuid(),
  addedAt: z.string().datetime(),
  metadata: MediaMetadataSchema,
});

/**
 * A page of library items.
 */
const MediaPageSchema = z.object({
  items: z.array(MediaSummarySchema),
  total: z.number().int().nonnegative(),
});

/**
 * What is actually in the libraries, for a page that offers ways to narrow
 * them.
 *
 * Both lists are read from the items rather than from a fixed taxonomy,
 * because a filter is only worth offering if something answers to it: a chip
 * for a genre nobody owns is a control whose only outcome is an empty page.
 *
 * Decades rather than years, since a year-by-year list of a large library is
 * eighty chips and nobody is looking for 1994 in particular.
 *
 * `maxRating` is the best score anything carries, which is how a caller
 * decides whether offering a rating floor at all is honest. It is zero for a
 * library nobody has matched against a catalogue.
 */
const LibraryFacetsSchema = z.object({
  genres: z.array(z.string()),
  decades: z.array(z.number().int()),
  maxRating: z.number().nonnegative(),
});

export type LibraryFacets = z.infer<typeof LibraryFacetsSchema>;
export type LibraryKind = z.infer<typeof LibraryKindSchema>;
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
