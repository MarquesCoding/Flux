import type { DeviceStore } from '@ValenceClient/platform/Platform.types';

/**
 * Where this client keeps what belongs to the device rather than to the account — which profile is
 * watching, the quality somebody pinned, how large they like the grid.
 *
 * Every read and write is guarded, because `localStorage` is not always there to be written to: a
 * private window, a browser configured to refuse it, or a quota already full all throw rather than
 * answer. None of that is worth failing a page over, so a store that cannot remember behaves as one
 * that has nothing to remember.
 *
 * @returns The store, for the platform to be installed with.
 */
const theBrowsersStore = (): DeviceStore => ({
  read: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  forget: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
});

export { theBrowsersStore };
