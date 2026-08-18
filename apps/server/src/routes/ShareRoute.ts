import { createRoute, z } from '@hono/zod-openapi';
import {
  AdminShareListSchema,
  CreatedShareSchema,
  NewShareSchema,
  ShareListSchema,
  ShareSchema,
} from '@FluxContracts/schemas/Share';
import { MediaSummarySchema } from '@FluxContracts/schemas/Library';

const Share = ShareSchema.openapi('Share');
const ShareList = ShareListSchema.openapi('ShareList');
const CreatedShare = CreatedShareSchema.openapi('CreatedShare');
const NewShare = NewShareSchema.openapi('NewShare');
const AdminShareList = AdminShareListSchema.openapi('AdminShareList');
const ShareError = z.object({ error: z.string() }).openapi('ShareError');

const OpenedShare = z
  .object({
    kind: z.enum(['item', 'series']),
    title: z.string(),
    items: z.array(MediaSummarySchema),
  })
  .openapi('OpenedShare');

const createShareRoute = createRoute({
  method: 'post',
  path: '/api/shares',
  tags: ['Sharing'],
  summary: 'Share something by link',
  request: { body: { content: { 'application/json': { schema: NewShare } } } },
  responses: {
    201: {
      description: 'The link, whose token is shown this once and never again',
      content: { 'application/json': { schema: CreatedShare } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ShareError } },
    },
    403: {
      description: 'This account may not share',
      content: { 'application/json': { schema: ShareError } },
    },
    404: {
      description: 'There is nothing here to share',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

const listSharesRoute = createRoute({
  method: 'get',
  path: '/api/shares',
  tags: ['Sharing'],
  summary: 'Read the links this account has handed out',
  responses: {
    200: {
      description: 'What they have shared',
      content: { 'application/json': { schema: ShareList } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

const revokeShareRoute = createRoute({
  method: 'delete',
  path: '/api/shares/{shareId}',
  tags: ['Sharing'],
  summary: 'Withdraw a link, at once and including anybody watching through it',
  request: { params: z.object({ shareId: z.string().uuid() }) },
  responses: {
    204: { description: 'Withdrawn' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ShareError } },
    },
    404: {
      description: 'No such link belonging to this account',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

const listEverybodysSharesRoute = createRoute({
  method: 'get',
  path: '/api/admin/shares',
  tags: ['Sharing'],
  summary: 'Read every link this server has handed out, and who handed each one out',
  responses: {
    200: {
      description: 'Every link',
      content: { 'application/json': { schema: AdminShareList } },
    },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ShareError } },
    },
    403: {
      description: 'This account may not look at everybody’s links',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

const revokeAnybodysShareRoute = createRoute({
  method: 'delete',
  path: '/api/admin/shares/{shareId}',
  tags: ['Sharing'],
  summary: 'Withdraw anybody’s link, at once and including anybody watching through it',
  request: { params: z.object({ shareId: z.string().uuid() }) },
  responses: {
    204: { description: 'Withdrawn' },
    401: {
      description: 'Nobody is signed in',
      content: { 'application/json': { schema: ShareError } },
    },
    403: {
      description: 'This account may not withdraw somebody else’s link',
      content: { 'application/json': { schema: ShareError } },
    },
    404: {
      description: 'No such link, or it had already been withdrawn',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

const openShareRoute = createRoute({
  method: 'get',
  path: '/api/share/{token}',
  tags: ['Sharing'],
  summary: 'Open a shared link, as somebody with no account',
  request: { params: z.object({ token: z.string().min(1) }) },
  responses: {
    200: {
      description: 'What was shared, and nothing else',
      content: { 'application/json': { schema: OpenedShare } },
    },
    404: {
      description: 'This link does not work',
      content: { 'application/json': { schema: ShareError } },
    },
    410: {
      description: 'This link no longer works',
      content: { 'application/json': { schema: ShareError } },
    },
  },
});

export {
  createShareRoute,
  listSharesRoute,
  listEverybodysSharesRoute,
  revokeShareRoute,
  revokeAnybodysShareRoute,
  openShareRoute,
  Share,
  OpenedShare,
};
