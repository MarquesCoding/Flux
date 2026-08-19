import { platformInUse } from '@FluxClient/platform/installPlatform';

/**
 * Puts a path on the server this client is watching.
 *
 * A browser answers with nothing, because the page it is running came from the server and a
 * relative path already points at it. A client with a window of its own has no such origin — its
 * pages come from itself — so it answers with the address the viewer configured, and every request
 * and every piece of artwork has to be built through here to reach anything at all.
 *
 * @param path - The path on the server, beginning with a slash.
 * @returns The path where this client should ask for it.
 */
const serverUrl = (path: string): string => {
  const server = platformInUse().whereTheServerIs();

  if (server === '') {
    return path;
  }

  return `${server.replace(/\/+$/, '')}${path}`;
};

export { serverUrl };
