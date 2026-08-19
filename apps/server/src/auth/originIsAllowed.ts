import { DESKTOP_ORIGINS } from '@FluxCore/functions/desktopScheme';

/**
 * Whether a client at this origin may read what the server answers.
 *
 * A browser served by Flux is same-origin and never asks. Anything else is a client with a window
 * of its own, and the only ones that may read a reply are the ones an operator named — the same
 * list better-auth is given, so a deployment configures where it may be reached from once.
 *
 * The desktop client's own scheme is always allowed. It is not a website: nothing on the internet can
 * navigate to `app.flux.desktop:/`, so allowing it grants no page anything it did not have.
 *
 * @param origin - What the request said it came from, or nothing where it said nothing.
 * @param trusted - The origins this deployment has been configured to answer.
 * @returns The origin to echo back, or nothing where it may not read the answer.
 */
const originIsAllowed = (origin: string | undefined, trusted: readonly string[]): string | null => {
  if (origin === undefined || origin === '') {
    return null;
  }

  const allowed = [...trusted, ...DESKTOP_ORIGINS].map((one) => one.replace(/\/+$/, ''));

  return allowed.includes(origin.replace(/\/+$/, '')) ? origin : null;
};

export { originIsAllowed };
