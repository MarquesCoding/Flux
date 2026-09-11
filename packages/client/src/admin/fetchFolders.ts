import { readFromServer } from '@ValenceClient/query/readFromServer';
import { FolderListingSchema } from '@ValenceContracts/schemas/Folder';
import type { FolderListing } from '@ValenceContracts/schemas/Folder';

/**
 * Lists the folders inside a folder on the machine running Valence, or the places worth starting
 * from where none is named — for an administrator choosing where a library lives.
 *
 * @param path - The folder to look inside, or nothing for the places to start from.
 * @returns What is inside it.
 */
const fetchFolders = async (path: string | null): Promise<FolderListing> =>
  readFromServer(
    path === null
      ? '/api/admin/folders'
      : `/api/admin/folders?${new URLSearchParams({ path }).toString()}`,
    FolderListingSchema,
  );

export { fetchFolders };
