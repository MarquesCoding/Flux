import { ownOrigins } from '@FluxServer/env/ownOrigins';
import { DESKTOP_ORIGINS } from '@FluxServer/auth/originIsAllowed';
type TrustedOriginsOptions = {
  configured: readonly string[];
  port: number;
  settings: { read: () => Promise<{ trustedOrigins: readonly string[] }> };
};

/**
 * Every origin this deployment answers to.
 *
 * The environment is unioned with the stored settings rather than consulted only at setup, which is
 * the fault FLUX-144 fixed: an operator editing `TRUSTED_ORIGINS` afterwards changed nothing,
 * silently. The addresses this machine holds are added, and so is the desktop client, which nobody
 * should have to configure.
 *
 * Read through here by everything that needs the list, because two places working it out separately
 * is how one of them comes to disagree — better-auth refused an origin the CORS headers had just
 * allowed, and the desktop client saw a server that would not answer.
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
    const named = [...new Set([...configured, ...stored])];

    return [...named, ...ownOrigins(named, port), ...DESKTOP_ORIGINS];
  };

export { trustedOriginsFor };
