import { createRoute, z } from '@hono/zod-openapi';
import { FolderListingSchema } from '@ValenceContracts/schemas/Folder';

const FolderError = z.object({ error: z.string() }).openapi('FolderError');

const listFoldersRoute = createRoute({
  method: 'get',
  path: '/api/admin/folders',
  tags: ['Admin'],
  summary: 'List the folders inside a folder on the server, to choose where a library lives',
  request: {
    query: z.object({ path: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'The folders inside it, or the places worth starting from where none is named',
      content: { 'application/json': { schema: FolderListingSchema } },
    },
    400: {
      description: 'A path that does not start from the root',
      content: { 'application/json': { schema: FolderError } },
    },
    403: {
      description: 'Not somebody who may add a library, or a folder Valence cannot read',
      content: { 'application/json': { schema: FolderError } },
    },
    404: {
      description: 'No such folder',
      content: { 'application/json': { schema: FolderError } },
    },
  },
});

export { listFoldersRoute };
