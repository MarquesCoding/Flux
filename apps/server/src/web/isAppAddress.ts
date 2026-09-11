const API_PREFIX = '/api';

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Decides whether an address nothing else answered should be given the application itself.
 *
 * The browser half of Valence is served by the same process as the API — one port, one origin, and
 * no second server to keep running. This is what decides, for an address the API did not claim and
 * no file answered, between handing back the application and admitting there is nothing there.
 *
 * A browser asking for `/library/some-film` is asking for a page the application draws rather than a
 * file on disk, so it is handed the application and lets the router sort it out. Two things are not:
 * anything under the API, which has already had its say and should answer for itself, and anything
 * that names a file, since a missing script served an HTML page fails far more confusingly than a
 * missing script served nothing.
 *
 * @param path - The address asked for.
 * @returns Whether to answer with the application.
 */
const isAppAddress = (path: string): boolean =>
  !path.startsWith(`${API_PREFIX}/`) && path !== API_PREFIX && !HAS_EXTENSION.test(path);

export { isAppAddress };
