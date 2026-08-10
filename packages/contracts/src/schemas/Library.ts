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
})

/**
 * Everything about an item, including the streams the negotiator needs.
 *
 * Structurally a superset of `MediaItem`, so it can be handed to
 * `negotiatePlayback` without conversion.
 */
const MediaDetailSchema = MediaItemSchema.extend({
  libraryId: z.string().uuid(),
  addedAt: z.string().datetime(),
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
export type MediaSummary = z.infer<typeof MediaSummarySchema>
export type MediaPage = z.infer<typeof MediaPageSchema>
export type MediaDetail = z.infer<typeof MediaDetailSchema>
export type ScanResult = z.infer<typeof ScanResultSchema>

export default {
  LIBRARY_KINDS,
  LibraryKindSchema,
  LibrarySchema,
  MediaSummarySchema,
  MediaPageSchema,
  MediaDetailSchema,
  ScanResultSchema,
}
