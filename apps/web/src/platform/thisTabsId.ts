import { randomId } from '@ValenceClient/platform/randomId';

const STORAGE_KEY = 'flux.clientId';

/**
 * Which open tab this is, made once and then kept for as long as the tab lives.
 *
 * Presence is per running client rather than per account, since one person with Valence open on a
 * phone and a television is two things to show and two sessions to be able to stop. A browser's
 * answer to that is a tab, which is what `sessionStorage` is scoped to; another client would answer
 * with a window or a process.
 *
 * @returns The identifier for this tab.
 */
const thisTabsId = (): string => {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);

    if (existing !== null) {
      return existing;
    }

    const created = randomId();

    window.sessionStorage.setItem(STORAGE_KEY, created);

    return created;
  } catch {
    return randomId();
  }
};

export { thisTabsId };
