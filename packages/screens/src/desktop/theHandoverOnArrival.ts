import { electronHandover } from '@FluxCore/functions/electronHandover';
import type { Handover } from '@FluxCore/functions/electronHandover';

const arrivedWith = electronHandover(
  Object.fromEntries(new URLSearchParams(window.location.search)),
);

/**
 * What a desktop client sent somebody here with, read once as the page loaded.
 *
 * Read here and not where it is wanted, because by then it is gone: the router validates what it
 * finds in the address and keeps only what it knows, so three parameters it has never heard of
 * survive exactly until the first navigation. This runs as the module is evaluated, which is before
 * anything is drawn and before anything navigates.
 *
 * @returns The handover, or nothing where somebody simply opened Flux.
 */
const theHandoverOnArrival = (): Handover | null => arrivedWith;

export { theHandoverOnArrival };
