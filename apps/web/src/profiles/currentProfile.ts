const STORAGE_KEY = 'flux.profile';

const PROFILE_HEADER = 'x-flux-profile';

/**
 * Who is watching on this device, if anybody has said.
 */
const readCurrentProfile = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Remembers who is watching on this device.
 */
const writeCurrentProfile = (profileId: string | null): void => {
  try {
    if (profileId === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, profileId);
    }
  } catch {}
};

/**
 * The headers that say who is watching.
 */
const profileHeaders = (): Record<string, string> => {
  const profileId = readCurrentProfile();

  return profileId === null ? {} : { [PROFILE_HEADER]: profileId };
};

export { readCurrentProfile, writeCurrentProfile, profileHeaders, STORAGE_KEY };
