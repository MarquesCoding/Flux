import type { BrowserWindow } from 'electron';

type SetsUpMain = {
  setupMain: (cfg: {
    csp?: boolean;
    scheme?: boolean;
    bridges?: boolean;
    getWindow?: () => BrowserWindow | null;
  }) => void;
};

/**
 * Registers the scheme a browser sends somebody back on, and the bridges the window asks through.
 *
 * Each part is named rather than left out. Passing any configuration at all turns all three off
 * unless they are asked for by name, so handing over only a way to find the window registered
 * nothing: the scheme was not claimed, and the window asked for a handler that was never there.
 *
 * The content security policy is the one part left off. The library builds it from the address the
 * client was constructed with, and this client is built against an address that resolves nowhere on
 * purpose, so that every request can be moved onto whichever server somebody named. Taking that
 * policy would permit connections to the placeholder and forbid them to the real server.
 *
 * @param auth - The client holding the session.
 * @param theWindow - How to find the window, which does not exist yet when this runs.
 */
const letTheBrowserSendThemBack = (
  auth: SetsUpMain,
  theWindow: () => BrowserWindow | null,
): void => {
  auth.setupMain({ csp: false, scheme: true, bridges: true, getWindow: theWindow });
};

export { letTheBrowserSendThemBack };
