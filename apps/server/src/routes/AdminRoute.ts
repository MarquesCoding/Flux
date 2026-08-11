import { createRoute, z } from '@hono/zod-openapi'

const AdminError = z.object({ error: z.string() }).openapi('AdminError')

const AdminUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('AdminUser')

const AdminSettingsSchema = z
  .object({
    /**
     * Whether a catalogue key is configured, never the key itself.
     *
     * An administration page has no business handing a secret back to a
     * browser: it is there to say whether one is set, not to show it.
     */
    hasCatalogueKey: z.boolean(),
    trustedOrigins: z.array(z.string()),
    cookieSecure: z.boolean(),
  })
  .openapi('AdminSettings')

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
  .openapi('AdminOverview')

const AdminSettingsRequestSchema = z
  .object({
    catalogueApiKey: z.string().optional(),
  })
  .openapi('AdminSettingsRequest')

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
})

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
})

export default { adminOverviewRoute, adminSettingsRoute }
