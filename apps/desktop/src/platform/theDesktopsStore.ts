import type { DeviceStore } from '@FluxClient/platform/Platform.types';

/**
 * Where this client keeps what belongs to the machine rather than to the account — which server it
 * watches, the token it was given, which profile is watching, the quality somebody pinned.
 *
 * A desktop window has web storage of its own that outlives the process, which is what makes it the
 * right place for the address: somebody says where their Flux is once rather than at every launch.
 * Every read and write is guarded anyway, because a store that cannot remember should behave as one
 * with nothing to remember rather than take the window down with it.
 *
 * @returns The store, for the platform to be installed with.
 */
const theDesktopsStore = (): DeviceStore => ({
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

export { theDesktopsStore };
