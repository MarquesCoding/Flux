import { createRoute, z } from '@hono/zod-openapi'
import LibraryModule from '@FluxContracts/schemas/Library'

const { LibrarySchema, MediaSummarySchema, MediaDetailSchema, LIBRARY_KINDS } = LibraryModule

const Library = LibrarySchema.openapi('Library')
const MediaSummary = MediaSummarySchema.openapi('MediaSummary')
const MediaDetail = MediaDetailSchema.openapi('MediaDetail')
const NotFound = z.object({ error: z.string() }).openapi('LibraryNotFound')

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
      content: { 'application/json': { schema: ScanAccepted } },
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
}
