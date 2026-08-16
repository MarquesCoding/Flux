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
 * Remembers who is watching on this device, or forgets them when given nothing. Kept on the device
 * rather than the account, because which person is watching is a property of the sofa: the same
 * account on a phone and a television is usually two different people.
 *
 * @param profileId - Who is watching, or null to forget.
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
