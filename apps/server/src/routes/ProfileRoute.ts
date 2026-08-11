import { createRoute, z } from '@hono/zod-openapi'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'

const { ViewerProfileSchema, ViewerProfileRequestSchema, ViewerProfileListSchema } =
  ViewerProfileModule

const ProfileError = z.object({ error: z.string() }).openapi('ProfileError')

const ProfileSchema = ViewerProfileSchema.openapi('ViewerProfile')
const ProfileListSchema = ViewerProfileListSchema.openapi('ViewerProfileList')
const ProfileRequestSchema = ViewerProfileRequestSchema.openapi('ViewerProfileRequest')

/**
 * Lists the people using this account.
 *
 * Always at least one: an account with nobody on it is asked for a default the
 * first time somebody looks, because viewing has to hang on a person.
 */
const listProfilesRoute = createRoute({
  method: 'get',
  path: '/api/profiles',
  tags: ['Profiles'],
  summary: 'List the people using this account',
  responses: {
    200: {
      description: 'The people using this account',
      content: { 'application/json': { schema: ProfileListSchema } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ProfileError } },
    },
  },
})

const createProfileRoute = createRoute({
  method: 'post',
  path: '/api/profiles',
  tags: ['Profiles'],
  summary: 'Add somebody to this account',
  request: { body: { content: { 'application/json': { schema: ProfileRequestSchema } } } },
  responses: {
    201: {
      description: 'The profile that was added',
      content: { 'application/json': { schema: ProfileSchema } },
    },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ProfileError } },
    },
    409: {
      description: 'This account already holds as many profiles as it may',
      content: { 'application/json': { schema: ProfileError } },
    },
  },
})

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/api/profiles/{profileId}',
  tags: ['Profiles'],
  summary: 'Rename or recolour a profile',
  request: {
    params: z.object({ profileId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: ProfileRequestSchema } } },
  },
  responses: {
    204: { description: 'Changed' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ProfileError } },
    },
    404: {
      description: 'No such profile on this account',
      content: { 'application/json': { schema: ProfileError } },
    },
  },
})

/**
 * Removes somebody from this account.
 *
 * Takes their viewing with them, which is why the last profile cannot go:
 * there would be nowhere left to record anything.
 */
const deleteProfileRoute = createRoute({
  method: 'delete',
  path: '/api/profiles/{profileId}',
  tags: ['Profiles'],
  summary: 'Remove somebody from this account',
  request: { params: z.object({ profileId: z.string().uuid() }) },
  responses: {
    204: { description: 'Removed' },
    401: {
      description: 'Not signed in',
      content: { 'application/json': { schema: ProfileError } },
    },
    404: {
      description: 'No such profile, or it is the only one left',
      content: { 'application/json': { schema: ProfileError } },
    },
  },
})

const PromoteRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
  })
  .openapi('PromoteProfileRequest')

/**
 * Gives a profile an account of its own.
 *
 * The intended way out of a shared login: somebody who started as a name on a
 * housemate's account ends up with their own, and keeps everything they have
 * watched — progress hangs on the profile, so changing who owns the profile
 * moves the viewing with the person.
 *
 * Administrators only, because it makes an account.
 */
const promoteProfileRoute = createRoute({
  method: 'post',
  path: '/api/admin/profiles/{profileId}/promote',
  tags: ['Admin'],
  summary: 'Give a profile an account of its own',
  request: {
    params: z.object({ profileId: z.string().uuid() }),
    body: { content: { 'application/json': { schema: PromoteRequestSchema } } },
  },
  responses: {
    200: {
      description: 'The profile, now on its own account',
      content: { 'application/json': { schema: ProfileSchema } },
    },
    403: {
      description: 'Not an administrator',
      content: { 'application/json': { schema: ProfileError } },
    },
    404: {
      description: 'No such profile',
      content: { 'application/json': { schema: ProfileError } },
    },
    409: {
      description: 'That address already has an account',
      content: { 'application/json': { schema: ProfileError } },
    },
  },
})

export default {
  listProfilesRoute,
  createProfileRoute,
  updateProfileRoute,
  deleteProfileRoute,
  promoteProfileRoute,
}
