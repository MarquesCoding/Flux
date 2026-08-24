import { createRoute, z } from '@hono/zod-openapi';
import { DeviceProfileSchema } from '@ValenceContracts/schemas/DeviceProfile';
import { DownloadQualitySchema, DownloadSchema } from '@ValenceContracts/schemas/Download';

const DownloadError = z.object({ error: z.string() }).openapi('DownloadError');

const DownloadOptionSchema = z
  .object({
    quality: DownloadQualitySchema,
    label: z.string(),
    meaning: z.string(),
    bytes: z.number().int().nonnegative().nullable(),
    comparison: z.string().nullable(),
    wouldTranscode: z.boolean(),
  })
  .openapi('DownloadOption');

const DownloadOfferSchema = z
  .object({
    mediaId: z.string().uuid(),
    title: z.string(),
    episodes: z.number().int().positive(),
    options: z.array(DownloadOptionSchema),
  })
  .openapi('DownloadOffer');

const DownloadListSchema = z.object({ downloads: z.array(DownloadSchema) }).openapi('DownloadList');

const HoldingSchema = z
  .object({
    mediaId: z.string().uuid(),
    quality: DownloadQualitySchema,
    heldAt: z.string().datetime(),
  })
  .openapi('DownloadHolding');

const HoldingListSchema = z
  .object({ holdings: z.array(HoldingSchema) })
  .openapi('DownloadHoldingList');

const offerDownloadRoute = createRoute({
  method: 'post',
  path: '/api/media/{mediaId}/downloads/offer',
  tags: ['Downloads'],
  summary: 'What could be downloaded, what each would cost, and what this device would have to do',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: z.object({ deviceProfile: DeviceProfileSchema }) } },
    },
  },
  responses: {
    200: {
      description: 'What is on offer',
      content: { 'application/json': { schema: DownloadOfferSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const askForDownloadRoute = createRoute({
  method: 'post',
  path: '/api/media/{mediaId}/downloads',
  tags: ['Downloads'],
  summary: 'Ask for a file to be prepared',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            quality: DownloadQualitySchema,
            audioLanguages: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'What is being prepared, and how far along it is',
      content: { 'application/json': { schema: DownloadSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
    404: {
      description: 'No such media item',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const offerSeriesRoute = createRoute({
  method: 'post',
  path: '/api/series/{seriesId}/downloads/offer',
  tags: ['Downloads'],
  summary: 'What a whole programme would cost, added up across its episodes',
  request: {
    params: z.object({ seriesId: z.string() }),
    body: {
      content: { 'application/json': { schema: z.object({ deviceProfile: DeviceProfileSchema }) } },
    },
  },
  responses: {
    200: {
      description: 'What is on offer',
      content: { 'application/json': { schema: DownloadOfferSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
    404: {
      description: 'No such programme',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const askForSeriesRoute = createRoute({
  method: 'post',
  path: '/api/series/{seriesId}/downloads',
  tags: ['Downloads'],
  summary: 'Ask for every episode of a programme to be prepared',
  request: {
    params: z.object({ seriesId: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            quality: DownloadQualitySchema,
            audioLanguages: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'What was queued',
      content: { 'application/json': { schema: DownloadListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const pauseDownloadRoute = createRoute({
  method: 'post',
  path: '/api/downloads/{id}/pause',
  tags: ['Downloads'],
  summary: 'Stop preparing this for now, keeping what is done',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Paused' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const resumeDownloadRoute = createRoute({
  method: 'post',
  path: '/api/downloads/{id}/resume',
  tags: ['Downloads'],
  summary: 'Carry on preparing this from where it stopped',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Resumed' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const listDownloadsRoute = createRoute({
  method: 'get',
  path: '/api/downloads',
  tags: ['Downloads'],
  summary: 'Everything this viewer has asked for, and how far along each is',
  responses: {
    200: {
      description: 'What has been asked for',
      content: { 'application/json': { schema: DownloadListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const forgetDownloadRoute = createRoute({
  method: 'delete',
  path: '/api/downloads/{id}',
  tags: ['Downloads'],
  summary: 'Stop keeping a prepared file on the server',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    204: { description: 'Forgotten' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const readDownloadRoute = createRoute({
  method: 'get',
  path: '/api/downloads/{id}/file',
  tags: ['Downloads'],
  summary: 'Fetch a prepared file',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: 'The file' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
    404: {
      description: 'Nothing prepared under that name',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const listHoldingsRoute = createRoute({
  method: 'get',
  path: '/api/downloads/holdings',
  tags: ['Downloads'],
  summary: 'What this viewer’s devices say they are holding',
  responses: {
    200: {
      description: 'What is held',
      content: { 'application/json': { schema: HoldingListSchema } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const holdDownloadRoute = createRoute({
  method: 'put',
  path: '/api/media/{mediaId}/holdings',
  tags: ['Downloads'],
  summary: 'Say this device now holds a copy',
  request: {
    params: z.object({ mediaId: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: z.object({ quality: DownloadQualitySchema }) } },
    },
  },
  responses: {
    204: { description: 'Recorded' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

const releaseDownloadRoute = createRoute({
  method: 'delete',
  path: '/api/media/{mediaId}/holdings/{quality}',
  tags: ['Downloads'],
  summary: 'Say this device no longer holds a copy',
  request: {
    params: z.object({ mediaId: z.string().uuid(), quality: DownloadQualitySchema }),
  },
  responses: {
    204: { description: 'Recorded' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: DownloadError } },
    },
  },
});

export {
  askForDownloadRoute,
  askForSeriesRoute,
  offerSeriesRoute,
  pauseDownloadRoute,
  resumeDownloadRoute,
  forgetDownloadRoute,
  holdDownloadRoute,
  listDownloadsRoute,
  listHoldingsRoute,
  offerDownloadRoute,
  readDownloadRoute,
  releaseDownloadRoute,
};
