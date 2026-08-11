import { createRoute, z } from '@hono/zod-openapi';
import { PlaybackPlanSchema } from '@FluxContracts/schemas/PlaybackPlan';
import { JobRunRequestSchema } from '@FluxServer/jobs/jobDefinitions';
import { ScheduleTriggerSchema } from '@FluxServer/jobs/scheduleTrigger';
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
  })
  .openapi('AdminSettings');

const AdminOverviewSchema = z
  .object({
    users: z.array(AdminUserSchema),
    settings: AdminSettingsSchema,
    transcoder: z.object({
      isReachable: z.boolean(),
      ffmpegVersion: z.string().nullable(),
      hardwareAccels: z.array(z.string()),
    }),
    library: z.object({
      itemCount: z.number().int().nonnegative(),
      libraryCount: z.number().int().nonnegative(),
    }),
  })
  .openapi('AdminOverview');

const AdminSettingsRequestSchema = z
  .object({
    catalogueApiKey: z.string().optional(),
  })
  .openapi('AdminSettingsRequest');

/**
 * Everything an administrator needs to see at once.
 *
 * One request rather than five: an administration page that opens with a
 * cascade of spinners tells its operator less than one that arrives whole.
 */
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

/**
 * One open tab, as an admin sees it.
 *
 * Presence itself, not the transcoder — this is why a browsing viewer who
 * has started nothing still shows up, and why a direct play (which never
 * touches the transcoder at all) does too.
 */
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

/**
 * Every tab that has the app open, for an admin to see who is around and
 * what they are watching.
 */
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

/**
 * Stops someone else's stream.
 *
 * Kicks the viewer out of the player immediately, with an explanation —
 * unlike closing their own tab, which they would never see a message for.
 */
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

/**
 * Pauses someone else's stream.
 *
 * Not a lock — the viewer can press play again themselves. A nudge, with an
 * explanation, not an enforced hold.
 */
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

/**
 * Resumes a stream an admin paused.
 */
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

/**
 * Changes a setting an operator owns.
 */
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

/**
 * A job an admin can start on demand, as the picker sees it.
 */
const AdminJobDefinitionSchema = z
  .object({
    kind: z.string(),
    label: z.string(),
    description: z.string(),
    needsLibrary: z.boolean(),
    destructive: z.boolean(),
  })
  .openapi('AdminJobDefinition');

/**
 * Every job kind the Work tab's picker can offer.
 */
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

/**
 * Starts a job of the given kind against a library, from the Work tab.
 *
 * Additive to the per-library scan/reset/regenerate-previews routes rather
 * than a replacement for them — those stay exactly as they are for the
 * Libraries panel's own buttons. This is the admin-gated, kind-generic
 * entry point the job picker needs instead.
 */
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

const AdminJobTriggerSchema = z
  .object({
    id: z.string(),
    trigger: ScheduleTriggerSchema,
  })
  .openapi('AdminJobTrigger');

/**
 * What makes a job run on its own, as the picker sees it.
 */
const AdminJobScheduleSchema = z
  .object({
    kind: z.string(),
    triggers: z.array(AdminJobTriggerSchema),
  })
  .openapi('AdminJobSchedule');

/**
 * Every job's current triggers, alongside `adminJobDefinitionsRoute`'s
 * catalogue of what each job is — kept as a separate request rather than
 * folded into the definitions themselves, since a schedule changes far more
 * often than what jobs exist.
 */
const adminJobSchedulesRoute = createRoute({
  method: 'get',
  path: '/api/admin/jobs/schedules',
  tags: ['Admin'],
  summary: 'List what makes each job run on its own',
  responses: {
    200: {
      description: 'Every job and its triggers',
      content: {
        'application/json': { schema: z.object({ schedules: z.array(AdminJobScheduleSchema) }) },
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

/**
 * Adds one trigger to a job.
 *
 * Additive rather than a setting that replaces what is there, because a job
 * holds a list: "nightly, and again whenever the server comes up" is two
 * triggers, and adding the second must not silently drop the first.
 */
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

/**
 * Removes one trigger from a job.
 */
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

export {
  adminOverviewRoute,
  adminSettingsRoute,
  adminSessionsRoute,
  adminStopSessionRoute,
  adminPauseSessionRoute,
  adminResumeSessionRoute,
  adminJobDefinitionsRoute,
  adminRunJobRoute,
  adminJobSchedulesRoute,
  adminAddJobTriggerRoute,
  adminRemoveJobTriggerRoute,
};
