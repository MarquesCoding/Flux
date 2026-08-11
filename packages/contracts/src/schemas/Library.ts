import { z } from 'zod'
import MediaItemModule from './MediaItem'

const { MediaItemSchema } = MediaItemModule

/**
 * The library kinds, as a tuple.
 *
 * Exported separately so route definitions can build their own schema with
 * the OpenAPI-extended `z` while still deriving the values from one place.
 * Mixing zod instances between packages breaks request type inference.
 */
const LIBRARY_KINDS = ['movies', 'shows', 'music'] as const

const LibraryKindSchema = z.enum(LIBRARY_KINDS)

/**
 * A root the scanner walks.
 *
 * `path` is a location inside the read-only media mount. Flux never writes
 * there, so a library is a view over the operator's files rather than a
 * container Flux owns. See ADR-0006.
 */
const LibrarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  kind: LibraryKindSchema,
  path: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
  lastScannedAt: z.string().datetime().nullable(),
  /**
   * A language every item's audio track selection should prefer, when it has
   * one in that language. Null leaves each file's own default track alone.
   */
  defaultAudioLanguage: z.string().nullable(),
})

/**
 * The library settings a dialog can change after creation.
 */
const UpdateLibraryRequestSchema = z.object({
  defaultAudioLanguage: z.string().nullable(),
})

/**
 * Enough of an item to draw it in a grid.
 *
 * Deliberately small: a library of tens of thousands of items should not ship
 * every stream's details to render a page of posters.
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
  /**
   * Whether artwork exists, rather than where it lives.
   *
   * The address is the server's own, derived from the item's id, so a grid
   * needs only to know whether to ask for it.
   */
  hasPoster: z.boolean().default(false),
  hasBackdrop: z.boolean().default(false),
  /**
   * What a catalogue thinks of it, out of ten.
   *
   * In the summary because a hero and a card both show it, and neither is
   * worth a second request to find one number.
   */
  rating: z.number().nullish(),
  /**
   * Where this sits in a series, when the path said it sits in one.
   *
   * Carried in the summary rather than only in the detail because a library is
   * grouped by it: a row per season needs to know which items belong to which
   * without asking about every item first.
   */
  seriesTitle: z.string().nullish(),
  seasonNumber: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
  /**
   * What a catalogue calls it.
   *
   * In the summary because searching is done by them: a page that has to ask
   * about every item before it can offer "Drama" is a page that asks a hundred
   * questions to draw one row of buttons.
   */
  genres: z.array(z.string()).nullish(),
})

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
})

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
  seriesTitle: z.string().nullish(),
  seasonNumber: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
})

const MediaDetailSchema = MediaItemSchema.extend({
  libraryId: z.string().uuid(),
  addedAt: z.string().datetime(),
  metadata: MediaMetadataSchema,
})

/**
 * A page of library items.
 */
const MediaPageSchema = z.object({
  items: z.array(MediaSummarySchema),
  total: z.number().int().nonnegative(),
})

const ScanResultSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export type LibraryKind = z.infer<typeof LibraryKindSchema>
export type Library = z.infer<typeof LibrarySchema>
export type UpdateLibraryRequest = z.infer<typeof UpdateLibraryRequestSchema>
export type MediaSummary = z.infer<typeof MediaSummarySchema>
export type MediaPage = z.infer<typeof MediaPageSchema>
export type MediaDetail = z.infer<typeof MediaDetailSchema>
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>
export type CastMember = z.infer<typeof CastMemberSchema>
export type ScanResult = z.infer<typeof ScanResultSchema>

export default {
  LIBRARY_KINDS,
  LibraryKindSchema,
  LibrarySchema,
  UpdateLibraryRequestSchema,
  MediaSummarySchema,
  MediaPageSchema,
  MediaDetailSchema,
  MediaMetadataSchema,
  CastMemberSchema,
  ScanResultSchema,
}
