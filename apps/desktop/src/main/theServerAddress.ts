import { thePreferenceFile } from '@FluxDesktop/main/thePreferenceFile';

const KEY = 'flux.server.address';

/**
 * Where this client has been told its Valence is, read from the same file the window writes it to.
 *
 * One key, one file, two processes. The window is what asks somebody for the address; this process
 * reads it back to know what to open, rather than being told separately — two copies of one answer
 * is how they come to disagree.
 *
 * @returns The address, or nothing before anybody has said.
 */
const theServerAddress = (): string => thePreferenceFile().all()[KEY] ?? '';

/**
 * Forgets it, so this client asks again.
 *
 * For an address typed wrong, a server that has moved, or somebody who runs more than one. It has to
 * live out here: once the window is showing the server's own pages there is no screen of ours left
 * to offer it, and the server's Valence has no idea it is being looked at through a window that could
 * be pointed somewhere else.
 */
const forgetTheServerAddress = (): void => {
  thePreferenceFile().forget(KEY);
};

export { forgetTheServerAddress, theServerAddress };
