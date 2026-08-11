import { createRoute, z } from '@hono/zod-openapi'
import LibraryModule from '@FluxContracts/schemas/Library'
import ShowModule from '@FluxContracts/schemas/Show'

const { LibrarySchema, MediaSummarySchema, MediaDetailSchema, LIBRARY_KINDS } = LibraryModule

const Library = LibrarySchema.openapi('Library')
const MediaSummary = MediaSummarySchema.openapi('MediaSummary')
const MediaDetail = MediaDetailSchema.openapi('MediaDetail')
const NotFound = z.object({ error: z.string() }).openapi('LibraryNotFound')

const { ShowListSchema: ShowListContract, ShowDetailSchema: ShowDetailContract } = ShowModule

const ShowListSchema = ShowListContract.openapi('ShowList')
const ShowDetailSchema = ShowDetailContract.openapi('ShowDetail')

const CreateLibraryRequest = z
  .object({
    name: z.string().min(1).max(100),
    kind: z.enum(LIBRARY_KINDS),
    path: z.string().min(1),
  })
  .openapi('CreateLibraryRequest')

const listLibrariesRoute = createRoute({
  method: 'get',
  path: '/api/libraries',
  tags: ['Library'],
  summary: 'List libraries',
  responses: {
    200: {
      description: 'Every library on this server',
      content: { 'application/json': { schema: z.array(Library) } },
    },
  },
})

const createLibraryRoute = createRoute({
  method: 'post',
  path: '/api/libraries',
  tags: ['Library'],
  summary: 'Add a library root',
  request: { body: { content: { 'application/json': { schema: CreateLibraryRequest } } } },
  responses: {
    201: {
      description: 'The library was added',
      content: { 'application/json': { schema: Library } },
    },
    400: {
      description: 'The path is not a readable directory',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

/**
 * Lists the items in a library.
 *
 * Returns summaries rather than full detail: a library of tens of thousands of
 * items should not ship every stream's details to draw a page of posters.
 */
const listItemsRoute = createRoute({
  method: 'get',
  path: '/api/libraries/{id}/items',
  tags: ['Library'],
  summary: 'List the items in a library',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      search: z.string().optional(),
      /**
       * Films or programmes, told apart by whether a file belongs to a series.
       */
      kind: z.enum(['films', 'shows']).optional(),
      genre: z.string().optional(),
      /**
       * Particular items, named outright and separated by commas. For a page
       * built from a list kept elsewhere, such as what a viewer has
       * favourited.
       */
      ids: z.string().optional(),
      order: z.enum(['title', 'newest']).optional(),
      limit: z.coerce.number().int().positive().max(200).optional(),
      offset: z.coerce.number().int().nonnegative().optional(),
    }),
  },
  responses: {
    200: {
      description: 'A page of items',
      content: {
        'application/json': {
          schema: z.object({ items: z.array(MediaSummary), total: z.number().int() }),
        },
      },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

const getMediaRoute = createRoute({
  method: 'get',
  path: '/api/media/{id}',
  tags: ['Library'],
  summary: 'Read one item in full',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'The item, including its streams',
      content: { 'application/json': { schema: MediaDetail } },
    },
    404: {
      description: 'No such item',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

const ScanAccepted = z.object({ jobId: z.string(), state: z.string() }).openapi('ScanAccepted')

/**
 * How far a scan has got.
 *
 * `phase` names what it is doing right now — probing files, then generating
 * trickplay and previews — since a single number cannot mean both. Null
 * rather than zero until a phase has counted its files: a scan sitting at 0
 * of 0 reads as finished, not as not yet started.
 */
const ScanState = z
  .object({
    jobId: z.string(),
    state: z.string(),
    phase: z.string().nullable(),
    processed: z.number().int().nonnegative().nullable(),
    total: z.number().int().nonnegative().nullable(),
  })
  .openapi('ScanState')

/**
 * Queues a scan.
 *
 * Answers 202 rather than waiting: walking and probing a real library takes
 * minutes, and an HTTP request that long will be cut off by every proxy
 * between the browser and the server while the work carries on unseen.
 *
 * `force=true` probes every file again instead of only those whose size or
 * modification time changed. Nothing about a file says whether Flux still
 * reads it the same way, so after a probing fix or a new metadata provider
 * this is the only way to pick the change up.
 */
const scanLibraryRoute = createRoute({
  method: 'post',
  path: '/api/libraries/{id}/scan',
  tags: ['Library'],
  summary: 'Queue a scan for new, changed and removed files',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ force: z.enum(['true', 'false']).optional() }),
  },
  responses: {
    202: {
      description: 'The scan was queued',
      content: { 'application/json': { schema: ScanAccepted } },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

const scanStateRoute = createRoute({
  method: 'get',
  path: '/api/libraries/scans/{jobId}',
  tags: ['Library'],
  summary: 'Report how a queued scan is getting on',
  request: { params: z.object({ jobId: z.string().min(1) }) },
  responses: {
    200: {
      description: 'The state of the scan',
      content: { 'application/json': { schema: ScanState } },
    },
  },
})

/**
 * Deletes every item in a library, then queues a scan to repopulate it from
 * nothing.
 *
 * A rebuild, not a rescan: an ordinary scan reconciles against what the
 * database already believes, and an operator reaching for this wants no part
 * of that history kept.
 */
/**
 * Lists the series in a library.
 *
 * A show is every item naming the same series, so this is a reading of the
 * library rather than a table in it — and it is read here rather than in a
 * browser because a page holds the first sixty things it was sent.
 */
const listShowsRoute = createRoute({
  method: 'get',
  path: '/api/libraries/{id}/shows',
  tags: ['Library'],
  summary: 'List the series in a library',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'The series, most recent arrival first',
      content: { 'application/json': { schema: ShowListSchema } },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

/**
 * Everything the library holds about one series.
 */
const getShowRoute = createRoute({
  method: 'get',
  path: '/api/libraries/{id}/shows/{showId}',
  tags: ['Library'],
  summary: 'Read one series and its episodes',
  request: {
    params: z.object({ id: z.string().uuid(), showId: z.string().min(1) }),
  },
  responses: {
    200: {
      description: 'The series, season by season',
      content: { 'application/json': { schema: ShowDetailSchema } },
    },
    404: {
      description: 'No such library or series',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

const resetLibraryRoute = createRoute({
  method: 'post',
  path: '/api/libraries/{id}/reset',
  tags: ['Library'],
  summary: 'Delete every item in a library and queue a scan to repopulate it from nothing',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    202: {
      description: 'The library was cleared and a scan was queued',
      content: { 'application/json': { schema: ScanAccepted } },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
  },
})

export default {
  listLibrariesRoute,
  createLibraryRoute,
  listItemsRoute,
  getMediaRoute,
  scanLibraryRoute,
  scanStateRoute,
  resetLibraryRoute,
  listShowsRoute,
  getShowRoute,
}
