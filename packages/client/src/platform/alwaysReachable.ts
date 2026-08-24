import type { Reachability } from '@ValenceClient/platform/Platform.types';

/**
 * What a client answers when it has no way of knowing whether the server is there.
 *
 * Saying it is reachable is the safe answer rather than the optimistic one. A client that guessed
 * the other way would hide the library, the search and the account from somebody whose connection
 * is perfectly fine, and offer them a shelf of downloads instead — which is a far worse way to be
 * wrong than letting a request fail and be retried.
 *
 * @returns A reachability that never changes its mind.
 */
const alwaysReachable = (): Reachability => ({
  isReachable: () => true,
  whenChanged: () => () => {},
});

export { alwaysReachable };
