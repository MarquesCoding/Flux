import { queryOptions } from '@tanstack/react-query';
import { fetchSession } from '@FluxWeb/session/fetchSession';
import { readVersion } from '@FluxWeb/session/readVersion';
import { fetchProfiles } from '@FluxWeb/profiles/fetchProfiles';
import { fetchEveryone } from '@FluxWeb/profiles/fetchEveryone';
import { fetchSetupStatus } from '@FluxWeb/setup/fetchSetupStatus';

const SESSION = ['session'] as const;

/**
 * Whether the server has been set up, which decides whether anything else is worth asking.
 *
 * @returns The query.
 */
const setup = () =>
  queryOptions({
    queryKey: [...SESSION, 'setup'],
    queryFn: () => fetchSetupStatus(),
  });

/**
 * Who is signed in.
 *
 * The first thing the application asks and the thing most of it depends on, which is exactly why it
 * belongs here rather than in a variable at the root passed down beside a `refresh` callback. A
 * screen that changes the session invalidates this key; every screen that reads it hears about it.
 *
 * @returns The query.
 */
const who = () =>
  queryOptions({
    queryKey: [...SESSION, 'who'],
    queryFn: () => fetchSession(),
  });

/**
 * What this build is, for the About screen and for telling an operator what they are running.
 *
 * @returns The query.
 */
const version = () =>
  queryOptions({
    queryKey: [...SESSION, 'version'],
    queryFn: () => readVersion(),
  });

/**
 * The faces belonging to the account that is signed in.
 *
 * @returns The query.
 */
const profiles = () =>
  queryOptions({
    queryKey: [...SESSION, 'profiles'],
    queryFn: () => fetchProfiles(),
  });

/**
 * Everybody who could sign in here, which is what the way-in screen shows and what a watch party
 * picks from when asking somebody along.
 *
 * @returns The query.
 */
const everyone = () =>
  queryOptions({
    queryKey: [...SESSION, 'everyone'],
    queryFn: () => fetchEveryone(),
  });

const sessionQueries = { setup, who, version, profiles, everyone, key: SESSION };

export { sessionQueries };
