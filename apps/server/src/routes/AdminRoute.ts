import { createRoute, z } from '@hono/zod-openapi';
import { PlaybackPlanSchema } from '@ValenceContracts/schemas/PlaybackPlan';
import { PREVIEW_QUALITIES } from '@ValenceContracts/schemas/PreviewQuality';
import { TranscodeReuseSchema } from '@ValenceContracts/schemas/TranscodeReuse';
import { JobRunRequestSchema } from '@ValenceServer/jobs/jobDefinitions';
import { ScheduleTriggerSchema } from '@ValenceServer/jobs/scheduleTrigger';
import { LogPageSchema, LogQuerySchema } from '@ValenceContracts/schemas/Log';
import { SessionMessageSchema } from '@ValenceContracts/schemas/SessionMessage';
import { ScanAccepted } from './LibraryRoute';

const AdminError = z.object({ error: z.string() }).openapi('AdminError');

const AdminUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('AdminUser');

const AdminSettingsSchema = z
  .object({
    hasCatalogueKey: z.boolean(),
    trustedOrigins: z.array(z.string()),
    cookieSecure: z.boolean(),
    hardwareAccel: z.string(),
    previewQuality: z.enum(PREVIEW_QUALITIES),
    showsProfilesBeforeSignIn: z.boolean(),
  })
  .openapi('AdminSettings');

const AdminOverviewSchema = z
  .object({
    users: z.array(AdminUserSchema),
    settings: AdminSettingsSchema,
    transcoder: z.object({
      isReachable: z.boolean(),
      address: z.string(),
      ffmpegVersion: z.string().nullable(),
      ffmpegSupported: z.boolean().default(true),
      hardwareAccels: z.array(z.string()),
      rejectedEncoders: z.array(z.object({ encoder: z.string(), reason: z.string() })),
      concurrentRenders: z.number().int().nonnegative().default(0),
      toneMapping: z.enum(['zscale', 'libplacebo', 'unavailable']).default('unavailable'),
      hardwareToneMaps: z.array(z.string()).default([]),
      chains: z
        .array(
          z.object({
            accel: z.string(),
            shape: z.enum(['preview', 'sheet', 'transcode']),
            bitDepth: z.number().int(),
            works: z.boolean(),
            reason: z.string().nullable().default(null),
          }),
        )
        .default([]),
    }),
    library: z.object({
      itemCount: z.number().int().nonnegative(),
      libraryCount: z.number().int().nonnegative(),
      bytes: z.number().nonnegative().default(0),
    }),
    artwork: z
      .object({
        count: z.number().int().nonnegative(),
        bytes: z.number().int().nonnegative(),
        atMs: z.number().int().nonnegative(),
      })
      .nullable()
      .default(null),
    jobs: z
      .object({
        stalled: z.array(
          z.object({
            kind: z.string(),
            label: z.string(),
            failures: z.number().int().positive(),
            everSucceeded: z.boolean(),
            reason: z.string(),
          }),
        ),
      })
      .default({ stalled: [] }),
  })
  .openapi('AdminOverview');

const ArtefactUseSchema = z.object({
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

const AdminSettingsRequestSchema = z
  .object({
    catalogueApiKey: z.string().optional(),
    hardwareAccel: z.string().optional(),
    previewQuality: z.enum(PREVIEW_QUALITIES).optional(),
    showsProfilesBeforeSignIn: z.boolean().optional(),
  })
  .openapi('AdminSettingsRequest');

const CatalogueMatchSchema = z
  .object({
    externalId: z.string(),
    kind: z.enum(['tv', 'movie']),
    title: z.string(),
    year: z.number().int().nullable(),
    overview: z.string().nullable(),
    posterUrl: z.string().nullable(),
  })
  .openapi('CatalogueMatch');

const searchCatalogueRoute = createRoute({
  method: 'get',
  path: '/api/admin/catalogue/search',
  tags: ['Admin'],
  summary: 'Search the metadata catalogue by name',
  request: {
    query: z.object({ query: z.string().min(1), kind: z.enum(['tv', 'movie']) }),
  },
  responses: {
    200: {
      description: 'What the catalogue offers under that name',
      content: {
        'application/json': {
          schema: z.object({ matches: z.array(CatalogueMatchSchema) }).openapi('CatalogueMatches'),
        },
      },
    },
    403: {
      description: 'Only an administrator may ask',
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
    },
  },
});

const adminOverviewRoute = createRoute({
  method: 'get',
  path: '/api/admin/overview',
  tags: ['Admin'],
  summary: 'Read the state of the server',
  responses: {
    200: {
      description: 'The state of the server',
      content: { 'application/json': { schema: AdminOverviewSchema } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminSessionSchema = z
  .object({
    clientId: z.string(),
    profileId: z.string().nullable(),
    profileName: z.string().nullable(),
    deviceLabel: z.string(),
    connectedAt: z.number(),
    playback: z
      .object({
        mediaId: z.string(),
        mediaTitle: z.string(),
        hasPoster: z.boolean(),
        hasBackdrop: z.boolean(),
        mode: z.enum(['direct', 'transcode']),
        plan: PlaybackPlanSchema,
        reuse: TranscodeReuseSchema.nullable(),
        isPlaying: z.boolean(),
        pausedByAdmin: z.boolean(),
        startedAt: z.number(),
        health: z
          .object({
            positionSeconds: z.number(),
            durationSeconds: z.number(),
            bufferedAheadSeconds: z.number(),
            presentedWidth: z.number(),
            presentedHeight: z.number(),
          })
          .nullable(),
      })
      .nullable(),
  })
  .openapi('AdminSession');

const adminSessionsRoute = createRoute({
  method: 'get',
  path: '/api/admin/sessions',
  tags: ['Admin'],
  summary: 'List every open tab',
  responses: {
    200: {
      description: 'Every open tab',
      content: { 'application/json': { schema: z.array(AdminSessionSchema) } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminStopSessionRoute = createRoute({
  method: 'delete',
  path: '/api/admin/sessions/{clientId}',
  tags: ['Admin'],
  summary: 'Stop a viewer’s stream',
  request: { params: z.object({ clientId: z.string().min(1) }) },
  responses: {
    204: { description: 'The stream was stopped' },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'That tab is not open',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminPauseSessionRoute = createRoute({
  method: 'post',
  path: '/api/admin/sessions/{clientId}/pause',
  tags: ['Admin'],
  summary: 'Pause a viewer’s stream',
  request: { params: z.object({ clientId: z.string().min(1) }) },
  responses: {
    204: { description: 'The stream was paused' },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'That tab is not open',
      content: { 'application/json': { schema: AdminError } },
    },
    409: {
      description: 'That tab is not watching anything',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminMessageSessionRoute = createRoute({
  method: 'post',
  path: '/api/admin/sessions/{clientId}/message',
  tags: ['Admin'],
  summary: 'Tell a viewer something, without touching what they are watching',
  request: {
    params: z.object({ clientId: z.string().min(1) }),
    body: { content: { 'application/json': { schema: SessionMessageSchema } } },
  },
  responses: {
    204: { description: 'The message was delivered' },
    403: {
      description: 'Not allowed to message viewers',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'That tab is not open',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminResumeSessionRoute = createRoute({
  method: 'post',
  path: '/api/admin/sessions/{clientId}/resume',
  tags: ['Admin'],
  summary: 'Resume a viewer’s stream',
  request: { params: z.object({ clientId: z.string().min(1) }) },
  responses: {
    204: { description: 'The stream was resumed' },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'That tab is not open',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminSettingsRoute = createRoute({
  method: 'patch',
  path: '/api/admin/settings',
  tags: ['Admin'],
  summary: 'Change the settings an operator owns',
  request: {
    body: { content: { 'application/json': { schema: AdminSettingsRequestSchema } } },
  },
  responses: {
    200: {
      description: 'What the settings now are',
      content: { 'application/json': { schema: AdminSettingsSchema } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminJobDefinitionSchema = z
  .object({
    kind: z.string(),
    label: z.string(),
    description: z.string(),
    needsLibrary: z.boolean(),
    destructive: z.boolean(),
  })
  .openapi('AdminJobDefinition');

const adminJobDefinitionsRoute = createRoute({
  method: 'get',
  path: '/api/admin/jobs/definitions',
  tags: ['Admin'],
  summary: 'List the jobs an admin can start on demand',
  responses: {
    200: {
      description: 'Every runnable job',
      content: {
        'application/json': {
          schema: z.object({ definitions: z.array(AdminJobDefinitionSchema) }),
        },
      },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminJobRunRequestSchema = JobRunRequestSchema.openapi('AdminJobRunRequest');

const adminRunJobRoute = createRoute({
  method: 'post',
  path: '/api/admin/jobs/{kind}/run',
  tags: ['Admin'],
  summary: 'Start a job on demand',
  request: {
    params: z.object({ kind: z.string().min(1) }),
    body: { content: { 'application/json': { schema: AdminJobRunRequestSchema } } },
  },
  responses: {
    202: {
      description: 'The job was queued',
      content: { 'application/json': { schema: ScanAccepted } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'No such job kind or library',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminCancelJobRoute = createRoute({
  method: 'post',
  path: '/api/admin/jobs/running/{jobId}/cancel',
  tags: ['Admin'],
  summary: 'Stop a job that is queued or running',
  request: {
    params: z.object({ jobId: z.string().min(1) }),
  },
  responses: {
    202: {
      description: 'The job was asked to stop',
      content: { 'application/json': { schema: z.object({ jobId: z.string() }) } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'Nothing to stop under that id',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminJobTriggerSchema = z
  .object({
    id: z.string(),
    trigger: ScheduleTriggerSchema,
  })
  .openapi('AdminJobTrigger');

const AdminJobScheduleSchema = z
  .object({
    kind: z.string(),
    triggers: z.array(AdminJobTriggerSchema),
  })
  .openapi('AdminJobSchedule');

const adminJobSchedulesRoute = createRoute({
  method: 'get',
  path: '/api/admin/jobs/schedules',
  tags: ['Admin'],
  summary: 'List what makes each job run on its own',
  responses: {
    200: {
      description: 'Every job and its triggers',
      content: {
        'application/json': {
          schema: z.object({
            schedules: z.array(AdminJobScheduleSchema),
            timezone: z.string().openapi({
              description:
                'The IANA zone a clock trigger is read in. A time without its zone is ambiguous, and reading it as UTC is what this reports so an operator need not guess.',
              example: 'Europe/London',
            }),
          }),
        },
      },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminAddTriggerRequestSchema = z
  .object({ trigger: ScheduleTriggerSchema })
  .openapi('AdminAddTriggerRequest');

const adminAddJobTriggerRoute = createRoute({
  method: 'post',
  path: '/api/admin/jobs/{kind}/triggers',
  tags: ['Admin'],
  summary: 'Add a trigger to a job',
  request: {
    params: z.object({ kind: z.string().min(1) }),
    body: { content: { 'application/json': { schema: AdminAddTriggerRequestSchema } } },
  },
  responses: {
    201: {
      description: 'The trigger was added',
      content: { 'application/json': { schema: AdminJobTriggerSchema } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'No such job kind',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminRemoveJobTriggerRoute = createRoute({
  method: 'delete',
  path: '/api/admin/jobs/{kind}/triggers/{triggerId}',
  tags: ['Admin'],
  summary: 'Remove a trigger from a job',
  request: {
    params: z.object({ kind: z.string().min(1), triggerId: z.string().min(1) }),
  },
  responses: {
    204: { description: 'The trigger was removed' },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
    404: {
      description: 'No such trigger',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const AdminStorageSchema = z
  .object({
    cache: z
      .object({
        previews: ArtefactUseSchema,
        trickplay: ArtefactUseSchema,
        sessions: ArtefactUseSchema,
        atMs: z.number(),
      })
      .nullable(),
    artwork: z
      .object({
        count: z.number().int().nonnegative(),
        bytes: z.number().int().nonnegative(),
        atMs: z.number().int().nonnegative(),
      })
      .nullable(),
    libraryBytes: z.number().nonnegative(),
  })
  .openapi('AdminStorage');

const adminMeasureStorageRoute = createRoute({
  method: 'post',
  path: '/api/admin/storage/measure',
  tags: ['Admin'],
  summary: 'Count what the caches are holding, now',
  responses: {
    200: {
      description: 'What the caches hold',
      content: { 'application/json': { schema: AdminStorageSchema } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

const adminLogsRoute = createRoute({
  method: 'post',
  path: '/api/admin/logs',
  tags: ['Admin'],
  summary: 'Read the log, filtered',
  request: {
    body: {
      content: { 'application/json': { schema: LogQuerySchema } },
    },
  },
  responses: {
    200: {
      description: 'The records that matched, newest first',
      content: { 'application/json': { schema: LogPageSchema } },
    },
    403: {
      description: 'Not allowed to read the logs',
      content: { 'application/json': { schema: AdminError } },
    },
  },
});

export {
  adminLogsRoute,
  searchCatalogueRoute,
  adminOverviewRoute,
  adminMeasureStorageRoute,
  adminSettingsRoute,
  adminSessionsRoute,
  adminStopSessionRoute,
  adminPauseSessionRoute,
  adminMessageSessionRoute,
  adminResumeSessionRoute,
  adminJobDefinitionsRoute,
  adminRunJobRoute,
  adminCancelJobRoute,
  adminJobSchedulesRoute,
  adminAddJobTriggerRoute,
  adminRemoveJobTriggerRoute,
};
