const STORAGE_KEY = 'flux.clientId';

/**
 * Which open tab this is.
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
