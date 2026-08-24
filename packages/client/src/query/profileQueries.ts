import { queryOptions } from '@tanstack/react-query';
import { fetchProfiles } from '@ValenceClient/profiles/fetchProfiles';
import { fetchEveryone } from '@ValenceClient/profiles/fetchEveryone';
import { readCurrentProfile } from '@ValenceClient/profiles/currentProfile';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

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
 * Where the device has recorded nobody, this is the first profile on the account rather than nobody
 * at all. That is the same answer the server reaches: a request carrying no profile header is
 * counted against the account's default profile, so anything deciding what to draw from "who is
 * watching" has to agree with what the history is already being written against.
 *
 * @returns The query.
 */
const watching = () =>
  queryOptions({
    queryKey: [...PROFILES, 'watching'],
    queryFn: async (): Promise<ViewerProfile | null> => {
      const chosen = readCurrentProfile();
      const everyone = await fetchProfiles();

      const picked =
        chosen === null ? undefined : everyone.find((profile) => profile.id === chosen);

      return picked ?? everyone[0] ?? null;
    },
  });

/**
 * Every face on this server rather than only the ones on this account, which is what an operator
 * choosing whose viewing to be told about is picking from.
 *
 * @returns The query.
 */
const everyone = () =>
  queryOptions({
    queryKey: [...PROFILES, 'everyone'],
    queryFn: () => fetchEveryone(),
  });

const profileQueries = { all, watching, everyone, key: PROFILES };

export { profileQueries };
