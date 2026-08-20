import { queryOptions } from '@tanstack/react-query';
import { fetchProfiles } from '@FluxClient/profiles/fetchProfiles';
import { readCurrentProfile } from '@FluxClient/profiles/currentProfile';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const PROFILES = ['profiles'] as const;

/**
 * The faces on this account, which is what the picker draws and what the settings edit.
 *
 * @returns The query.
 */
const all = () =>
  queryOptions({
    queryKey: [...PROFILES, 'all'],
    queryFn: () => fetchProfiles(),
  });

/**
 * The profile currently watching, picked out of the list rather than asked for separately.
 *
 * The server has no endpoint for "the one watching" because it does not decide that — a device does,
 * and it keeps the answer. So the list is asked for and the device's answer picks from it.
 *
 * @returns The query.
 */
const watching = () =>
  queryOptions({
    queryKey: [...PROFILES, 'watching'],
    queryFn: async (): Promise<ViewerProfile | null> => {
      const chosen = readCurrentProfile();

      if (chosen === null) {
        return null;
      }

      return (await fetchProfiles()).find((profile) => profile.id === chosen) ?? null;
    },
  });

const profileQueries = { all, watching, key: PROFILES };

export { profileQueries };
