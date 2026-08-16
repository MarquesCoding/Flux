import { createRoute, z } from '@hono/zod-openapi';
import {
  LibrarySchema,
  UpdateLibraryRequestSchema,
  MediaSummarySchema,
  MediaDetailSchema,
  LibraryFacetsSchema,
  LIBRARY_KINDS,
} from '@FluxContracts/schemas/Library';
import {
  ShowListSchema as ShowListContract,
  ShowDetailSchema as ShowDetailContract,
} from '@FluxContracts/schemas/Show';

const Library = LibrarySchema.openapi('Library');
const MediaSummary = MediaSummarySchema.openapi('MediaSummary');
const MediaDetail = MediaDetailSchema.openapi('MediaDetail');
const LibraryFacets = LibraryFacetsSchema.openapi('LibraryFacets');
const NotFound = z.object({ error: z.string() }).openapi('LibraryNotFound');
const Forbidden = z.object({ error: z.string() }).openapi('LibraryForbidden');

const ShowListSchema = ShowListContract.openapi('ShowList');
const ShowDetailSchema = ShowDetailContract.openapi('ShowDetail');

const CreateLibraryRequest = z
  .object({
    name: z.string().min(1).max(100),
    kind: z.enum(LIBRARY_KINDS),
    path: z.string().min(1),
  })
  .openapi('CreateLibraryRequest');

const UpdateLibraryRequest = UpdateLibraryRequestSchema.openapi('UpdateLibraryRequest');

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
});

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
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: Forbidden } },
    },
  },
});

const updateLibraryRoute = createRoute({
  method: 'patch',
  path: '/api/libraries/{id}',
  tags: ['Library'],
  summary: "Change a library's settings",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: UpdateLibraryRequest } } },
  },
  responses: {
    200: {
      description: 'The library was updated',
      content: { 'application/json': { schema: Library } },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: Forbidden } },
    },
  },
});

const listFacetsRoute = createRoute({
  method: 'get',
  path: '/api/library-facets',
  tags: ['Library'],
  summary: 'List what there is to filter by',
  responses: {
    200: {
      description: 'The genres and decades in use, and the best rating held',
      content: { 'application/json': { schema: LibraryFacets } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

const listItemsRoute = createRoute({
  method: 'get',
  path: '/api/libraries/{id}/items',
  tags: ['Library'],
  summary: 'List the items in a library',
  request: {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      search: z.string().optional(),
      kind: z.enum(['films', 'shows']).optional(),
      genre: z.string().optional(),
      yearFrom: z.coerce.number().int().optional(),
      yearTo: z.coerce.number().int().optional(),
      minRating: z.coerce.number().min(0).max(10).optional(),
      ids: z.string().optional(),
      order: z.enum(['title', 'newest', 'yourRating']).optional(),
      minYourStars: z.coerce.number().int().min(1).max(5).optional(),
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
});

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
});

const ScanAccepted = z.object({ jobId: z.string(), state: z.string() }).openapi('ScanAccepted');

const ScanState = z
  .object({
    jobId: z.string(),
    state: z.string(),
    phase: z.string().nullable(),
    processed: z.number().int().nonnegative().nullable(),
    total: z.number().int().nonnegative().nullable(),
  })
  .openapi('ScanState');

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
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: Forbidden } },
    },
  },
});

const CorrectionRequest = z
  .object({
    reference: z.string().min(1),
    kind: z.enum(['tv', 'movie']).optional(),
  })
  .openapi('CorrectionRequest');

const Correction = z
  .object({
    corrected: z.number().int().nonnegative(),
    jobId: z.string().nullable(),
  })
  .openapi('Correction');

const correctMatchRoute = createRoute({
  method: 'post',
  path: '/api/media/{id}/match',
  tags: ['Library'],
  summary: 'Correct which catalogue entry a file is, and read it again',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { 'application/json': { schema: CorrectionRequest } } },
  },
  responses: {
    200: {
      description: 'How many files the correction reached',
      content: { 'application/json': { schema: Correction } },
    },
    400: {
      description: 'Nothing in what was pasted looked like a catalogue id',
      content: { 'application/json': { schema: NotFound } },
    },
    404: {
      description: 'No such item',
      content: { 'application/json': { schema: NotFound } },
    },
  },
});

const RebuiltArtefacts = z
  .object({ preview: z.boolean(), trickplay: z.boolean() })
  .openapi('RebuiltArtefacts');

const rebuildArtefactsRoute = createRoute({
  method: 'post',
  path: '/api/media/{id}/artefacts/rebuild',
  tags: ['Library'],
  summary: 'Throw away one item’s preview and thumbnails so they are made again',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'What was there to throw away',
      content: { 'application/json': { schema: RebuiltArtefacts } },
    },
    404: {
      description: 'No such item',
      content: { 'application/json': { schema: NotFound } },
    },
  },
});

const forgetCorrectionRoute = createRoute({
  method: 'delete',
  path: '/api/media/{id}/match',
  tags: ['Library'],
  summary: 'Forget a correction and read the file as the catalogue finds it',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: 'How many files went back to the catalogue',
      content: { 'application/json': { schema: Correction } },
    },
    404: {
      description: 'No such item',
      content: { 'application/json': { schema: NotFound } },
    },
  },
});

const runningScansRoute = createRoute({
  method: 'get',
  path: '/api/libraries/scans',
  tags: ['Library'],
  summary: 'List the scans running right now',
  responses: {
    200: {
      description: 'What the server is working on',
      content: {
        'application/json': {
          schema: z
            .object({
              scans: z.array(
                z.object({
                  jobId: z.string(),
                  kind: z.string(),
                  libraryId: z.string().nullable(),
                  phase: z.string().nullable(),
                  processed: z.number().nullable(),
                  total: z.number().nullable(),
                }),
              ),
            })
            .openapi('RunningScans'),
        },
      },
    },
  },
});

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
});

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
});

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
});

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
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: Forbidden } },
    },
  },
});

const regeneratePreviewsRoute = createRoute({
  method: 'post',
  path: '/api/libraries/{id}/regenerate-previews',
  tags: ['Library'],
  summary: "Queue preview regeneration for a library's current forced audio language",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    202: {
      description: 'Preview regeneration was queued',
      content: { 'application/json': { schema: ScanAccepted } },
    },
    404: {
      description: 'No such library',
      content: { 'application/json': { schema: NotFound } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: Forbidden } },
    },
  },
});

export { ScanAccepted };

export {
  listLibrariesRoute,
  createLibraryRoute,
  updateLibraryRoute,
  listItemsRoute,
  listFacetsRoute,
  getMediaRoute,
  scanLibraryRoute,
  scanStateRoute,
  resetLibraryRoute,
  listShowsRoute,
  getShowRoute,
  runningScansRoute,
  correctMatchRoute,
  forgetCorrectionRoute,
  rebuildArtefactsRoute,
  regeneratePreviewsRoute,
};
