import type { SignInElsewhere } from '@FluxClient/platform/Platform.types';

/**
 * How this client signs somebody in, which is by not doing it here.
 *
 * The window opens their own browser at the server's own pages, where a cookie is a cookie: a second
 * factor, a passkey and a saved password all work as they always have, and none of it has to be
 * reinvented for a window that cannot hold a cookie. What comes back is a single-use code, exchanged
 * out in the main process for a session the page cannot read.
 *
 * A browser answers `null` to this and signs somebody in where they already are.
 *
 * @returns Starting it, and a way to be told when it is done.
 */
const signInThroughABrowser = (): SignInElsewhere => ({
  start: () => window.requestAuth(),
  whenDone: (then) => window.onAuthenticated(() => {
    then();
  }),
});

export { signInThroughABrowser };
