import { createRoute, z } from '@hono/zod-openapi';
import { PersonSchema, PersonCreditsSchema } from '@ValenceContracts/schemas/Person';

const Person = PersonSchema.openapi('Person');
const PersonCredits = PersonCreditsSchema.openapi('PersonCredits');
const PersonError = z.object({ error: z.string() }).openapi('PersonError');

const readPersonRoute = createRoute({
  method: 'get',
  path: '/api/people/{personId}',
  tags: ['People'],
  summary: 'Read what the catalogue knows about somebody',
  request: { params: z.object({ personId: z.coerce.number().int().positive() }) },
  responses: {
    200: {
      description: 'Who they are',
      content: { 'application/json': { schema: Person } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: PersonError } },
    },
    404: {
      description: 'The catalogue knows nobody by that identifier',
      content: { 'application/json': { schema: PersonError } },
    },
  },
});

const readPersonCreditsRoute = createRoute({
  method: 'get',
  path: '/api/people/{personId}/credits',
  tags: ['People'],
  summary: 'Read what of theirs is on this server',
  request: { params: z.object({ personId: z.coerce.number().int().positive() }) },
  responses: {
    200: {
      description: 'What this server holds that they are in',
      content: { 'application/json': { schema: PersonCredits } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: PersonError } },
    },
  },
});

export { readPersonRoute, readPersonCreditsRoute };
