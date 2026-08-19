import { asCookiePairs } from '@FluxCore/functions/asCookiePairs';
import { platformInUse } from '@FluxClient/platform/installPlatform';
import { hasNoSharedOrigin } from '@FluxClient/session/hasNoSharedOrigin';

const KEY = 'flux.auth.cookies';

/**
 * The cookies this client is holding on the server's behalf, ready to be handed back.
 *
 * A browser holds none and never will: it has the real ones, and a signed challenge sitting in web
 * storage beside them would be a credential in the open for no gain. This is for the client that
 * cannot be sent a cookie at all — see ADR-0026.
 *
 * @returns What to send, or nothing where there is nothing to send.
 */
const authCookies = (): string | null =>
  hasNoSharedOrigin() ? platformInUse().store.read(KEY) : null;

/**
 * Keeps what the server just said to hold, and lets go of what it said to drop.
 *
 * Merged rather than replaced, because one answer says both things at once: verifying a second
 * factor clears the challenge and sets the trusted device in the same breath. An emptied value is
 * the server saying the challenge is over, and a client that kept it would go on presenting
 * something already spent.
 *
 * @param handed - What the server answered with.
 */
const rememberAuthCookies = (handed: string): void => {
  if (!hasNoSharedOrigin()) {
    return;
  }

  const held = new Map(
    asCookiePairs((authCookies() ?? '').split(';')).map(({ name, value }) => [name, value]),
  );

  for (const { name, value } of asCookiePairs(handed.split(';'))) {
    if (value === '') {
      held.delete(name);
    } else {
      held.set(name, value);
    }
  }

  if (held.size === 0) {
    platformInUse().store.forget(KEY);

    return;
  }

  platformInUse().store.write(
    KEY,
    [...held].map(([name, value]) => `${name}=${value}`).join('; '),
  );
};

/**
 * Drops everything this client was holding, for signing out — a challenge nobody answered is not
 * something to still be carrying next time somebody signs in.
 */
const forgetAuthCookies = (): void => {
  platformInUse().store.forget(KEY);
};

export { authCookies, forgetAuthCookies, rememberAuthCookies };
