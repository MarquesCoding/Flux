import type { DeviceStore } from '@ValenceClient/platform/Platform.types';

/**
 * Where this client keeps what belongs to the machine rather than to the account — which server it
 * watches, which profile is watching, the quality somebody pinned.
 *
 * A file held by the main process rather than the window's web storage, which is what a browser
 * would use. Web storage belongs to an origin, and this client does not keep one: it is served from
 * a dev server while it is being worked on and from a file once it is built, so anything kept in one
 * is invisible to the other — somebody would say where their Valence is, build the application, and be
 * asked again.
 *
 * Reads are answered from a copy the preload script took before the page ran, so nothing waits: a
 * preference is read while something is being drawn, and nothing sensible can be drawn around a
 * promise. A write goes to the copy at once and to the file behind it.
 *
 * The copy is taken again here rather than used where it lies. What the preload script hands over is
 * frozen — a context bridge freezes everything it exposes, which is the point of it — so writing to
 * it throws, and the first thing anybody does in this client is say where their server is.
 *
 * @returns The store.
 */
const theDesktopsStore = (): DeviceStore => {
  const { preferences } = window.flux;
  const held = new Map(Object.entries(preferences.held));

  return {
    read: (key) => held.get(key) ?? null,
    write: (key, value) => {
      held.set(key, value);
      preferences.write(key, value);
    },
    forget: (key) => {
      held.delete(key);
      preferences.forget(key);
    },
  };
};

export { theDesktopsStore };
