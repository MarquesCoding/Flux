import { platformInUse } from '@ValenceClient/platform/installPlatform';

const STORAGE_KEY = 'valence.profile';

const PROFILE_HEADER = 'x-valence-profile';

/**
 * Who is watching on this device, where somebody has chosen. Held on the device rather than in the
 * session, since a household shares one account and each screen in it may be a different person.
 */
const readCurrentProfile = (): string | null => platformInUse().store.read(STORAGE_KEY);

/**
 * Remembers who is watching on this device, or forgets them when given nothing. Kept on the device
 * rather than the account, because which person is watching is a property of the sofa: the same
 * account on a phone and a television is usually two different people.
 *
 * @param profileId - Who is watching, or null to forget.
 */
const writeCurrentProfile = (profileId: string | null): void => {
  const { store } = platformInUse();

  if (profileId === null) {
    store.forget(STORAGE_KEY);
  } else {
    store.write(STORAGE_KEY, profileId);
  }
};

/**
 * The headers that tell the server which profile a request is for, so that history, favourites and
 * progress land against the right person rather than against the account.
 */
const profileHeaders = (): Record<string, string> => {
  const profileId = readCurrentProfile();

  return profileId === null ? {} : { [PROFILE_HEADER]: profileId };
};

export { readCurrentProfile, writeCurrentProfile, profileHeaders, STORAGE_KEY };
