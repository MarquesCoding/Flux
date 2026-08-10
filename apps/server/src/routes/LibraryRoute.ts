import { createRoute, z } from '@hono/zod-openapi'
import LibraryModule from '@FluxContracts/schemas/Library'

const { LibrarySchema, MediaSummarySchema, MediaDetailSchema, ScanResultSchema, LIBRARY_KINDS } =
  LibraryModule

const Library = LibrarySchema.openapi('Library')
const MediaSummary = MediaSummarySchema.openapi('MediaSummary')
const MediaDetail = MediaDetailSchema.openapi('MediaDetail')
const ScanResult = ScanResultSchema.openapi('ScanResult')
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

const scanLibraryRoute = createRoute({
  method: 'post',
  path: '/api/libraries/{id}/scan',
  tags: ['Library'],
  summary: 'Scan a library for new, changed and removed files',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'What the scan changed',
      content: { 'application/json': { schema: ScanResult } },
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
}
