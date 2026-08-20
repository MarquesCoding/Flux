const MARK = 'fluxDesktop';

const CHANGE_SERVER = 'flux:change-server';

/**
 * Whether these pages are being shown inside Flux's own window rather than a browser.
 *
 * They are the same pages either way — a desktop client is a window pointed at a server, and what it
 * loads is what the server sends anybody. What tells them apart is a mark the window puts on the
 * document before the page runs, which a browser has nothing to put there.
 *
 * A mark and an event rather than a function left on the window, so that neither side has to be
 * handed the other's types and nothing here has to trust a global to be what it claims.
 *
 * @returns Whether there is a window listening.
 */
const isTheDesktopClient = (): boolean => document.documentElement.dataset[MARK] === 'true';

/**
 * Asks the window to point itself at a different server.
 *
 * The only thing these pages can ask of the client showing them, and the one thing the server cannot
 * do for itself: a browser is already wherever it was opened, and a window is not.
 */
const askForADifferentServer = (): void => {
  document.dispatchEvent(new CustomEvent(CHANGE_SERVER));
};

export { askForADifferentServer, isTheDesktopClient };
