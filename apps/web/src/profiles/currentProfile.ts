/**
 * Where the chosen profile is remembered.
 *
 * On the device rather than on the account, because which person is watching
 * is a property of the sofa, not of the login: the same account on a phone and
 * a television is usually two different people.
 */
const STORAGE_KEY = 'flux.profile';

/**
 * The header the server reads the watching profile from.
 */
const PROFILE_HEADER = 'x-flux-profile';

/**
 * Who is watching on this device, if anybody has said.
 */
const readCurrentProfile = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // A browser refusing storage is a browser in private mode, not a broken
    // one. Everything still works; it just asks who is watching each time.
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
  } catch {
    // Nothing to do. The choice lasts for this session instead of for this
    // device, which is a smaller loss than refusing to let anybody watch.
  }
};

/**
 * The headers that say who is watching.
 *
 * Empty when nobody has been chosen, which the server reads as "whoever this
 * account defaults to" rather than as an error.
 */
const profileHeaders = (): Record<string, string> => {
  const profileId = readCurrentProfile();

  return profileId === null ? {} : { [PROFILE_HEADER]: profileId };
};

export { readCurrentProfile, writeCurrentProfile, profileHeaders, STORAGE_KEY };
