const STORAGE_KEY = 'flux.clientId';

/**
 * Which open tab this is, made once and then kept for as long as the tab lives. Presence is per tab
 * rather than per account, since one person with the app open on a phone and a television is two
 * things to show and two sessions to be able to stop.
 */
const readClientId = (): string => {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);

    if (existing !== null) {
      return existing;
    }

    const created = crypto.randomUUID();

    window.sessionStorage.setItem(STORAGE_KEY, created);

    return created;
  } catch {
    return crypto.randomUUID();
  }
};

export { readClientId };
