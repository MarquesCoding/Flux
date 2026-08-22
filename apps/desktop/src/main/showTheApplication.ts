import { ORIGIN } from '@FluxDesktop/main/serveTheApplication';
import type { Fillable } from '@FluxDesktop/main/TheWindow.types';

/**
 * Puts Valence in the window.
 *
 * There is only one address now, and it is this client's own: the pages are ours, served from our
 * scheme, and what they ask of a server goes out through the process that owns this window. That is
 * the difference between a host and a window onto somebody else's site, and it is why nothing here
 * has to know whether a server has been chosen yet — the pages do, and they ask for one.
 *
 * @param window - The window to fill.
 */
const showTheApplication = async (window: Fillable): Promise<void> => {
  await window.loadURL(`${ORIGIN}/`);
};

export { showTheApplication };
