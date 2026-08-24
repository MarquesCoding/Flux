import { ownOrigins } from '@ValenceServer/env/ownOrigins';

const THE_DESKTOP_CLIENT = 'valence://app';

type TrustedOriginsOptions = {
  configured: readonly string[];
  port: number;
  settings: { read: () => Promise<{ trustedOrigins: readonly string[] }> };
};

/**
 * Every origin this deployment answers to.
 *
 * The environment is unioned with the stored settings rather than consulted only at setup, which is
 * the fault VAL-144 fixed: an operator editing `TRUSTED_ORIGINS` afterwards changed nothing,
 * silently. The addresses this machine holds are added, since a client reaching this server by one of
 * them is reaching this server.
 *
 * Read through here by everything that needs the list, because two places working it out separately
 * is how one of them comes to disagree — better-auth refused an origin the CORS headers had just
 * allowed, and the desktop client saw a server that would not answer.
 *
 * The desktop client's own scheme is always trusted, and needs to be. Its pages are served from
 * `valence://app`, which is an origin no operator would think to configure and which every Valence
 * would need configured identically — so leaving it out meant signing out silently failed on the
 * desktop, refused as an invalid origin, leaving somebody signed in on a machine they had walked
 * away from.
 *
 * It is safe to trust because it cannot be borrowed. A browser writes the origin header itself and
 * will not write that one; only an application that registered the scheme can be on it, and the only
 * application that registers it is this one.
 *
 * @param configured - What the environment named.
 * @param port - The port this server listens on, for working out its own addresses.
 * @param settings - Where an operator's later additions are stored.
 * @returns A function answering the origins, read afresh each time it is asked.
 */
const trustedOriginsFor =
  ({ configured, port, settings }: TrustedOriginsOptions) =>
  async (): Promise<string[]> => {
    const stored = (await settings.read()).trustedOrigins;
    const named = [...new Set([...configured, ...stored, THE_DESKTOP_CLIENT])];

    return [...named, ...ownOrigins(named, port)];
  };

export { trustedOriginsFor };
