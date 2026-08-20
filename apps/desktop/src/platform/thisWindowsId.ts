import { randomId } from '@FluxClient/platform/randomId';

const id = randomId();

/**
 * Which running Flux this is, made once when the process starts and kept until it ends.
 *
 * A browser answers this with a tab, because a tab is what a person opens and closes. A desktop
 * client is a process: closing the window ends the thing that was watching, and opening it again is
 * something new to show in the sessions list rather than the same one returning.
 *
 * @returns The identifier for this running client.
 */
const thisWindowsId = (): string => id;

export { thisWindowsId };
