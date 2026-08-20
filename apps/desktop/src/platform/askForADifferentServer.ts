import { rememberServerAddress } from '@FluxClient/session/serverAddress';

/**
 * Forgets which Flux this client was watching, so it asks again.
 *
 * A browser has no use for this — it is answered by the page it was served, and cannot be pointed
 * anywhere else. A client with a window of its own was told once and would otherwise be told once
 * forever, which is no help to somebody who typed the wrong address or runs more than one server.
 *
 * The window is reloaded rather than asked to redraw, because what has to be forgotten is not only
 * the address: it is every answer already cached from the server it belonged to.
 */
const askForADifferentServer = (): void => {
  rememberServerAddress(null);
  window.location.reload();
};

export { askForADifferentServer };
