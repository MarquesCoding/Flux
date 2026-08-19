import { thePreferenceFile } from '@FluxDesktop/main/thePreferenceFile';

const KEY = 'flux.server.address';

/**
 * Where this client has been told its Flux is, read from the same file the window reads.
 *
 * One key, one file, two processes. The window is what asks somebody for the address and what writes
 * it down; this process needs it to know where to send them to sign in, and reads it back rather
 * than being told separately — two copies of one answer is how they come to disagree.
 *
 * @returns The address, or nothing before anybody has said.
 */
const theServerAddress = (): string => thePreferenceFile().all()[KEY] ?? '';

export { theServerAddress };
