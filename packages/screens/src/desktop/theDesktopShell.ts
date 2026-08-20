const MARK = 'fluxDesktop';

const CHANGE_SERVER = 'flux:change-server';

const NOW_WATCHING = 'flux:now-watching';

type WhatIsBeingWatched = {
  title: string;
  series: string | null;
  season: number | null;
  episode: number | null;
  startedAt: number;
  endsAt: number | null;
  tmdbId: string | null;
  isSeries: boolean;
};

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

/**
 * Tells the window what somebody is watching, for it to publish where a page cannot.
 *
 * Discord's status is a socket on the same machine, which no page can open — so the page says what
 * is playing and the window says it to Discord. Nothing is sent unless the profile asked for it,
 * which is decided before this is called and not here.
 *
 * @param watching - What is playing, or nothing to say that nothing is.
 */
const nowWatching = (watching: WhatIsBeingWatched | null): void => {
  document.dispatchEvent(new CustomEvent(NOW_WATCHING, { detail: watching }));
};

export type { WhatIsBeingWatched };

export { askForADifferentServer, isTheDesktopClient, nowWatching };
