import { load } from '@tauri-apps/plugin-store';
import type { DeviceStore } from '@FluxClient/platform/Platform.types';

const FILE = 'settings.json';

type HeldStore = DeviceStore & { hydrate: () => Promise<void> };

/**
 * Where this client keeps what belongs to the machine rather than to the account — which server it
 * watches, the token it was given, which profile is watching, the quality somebody pinned.
 *
 * A file rather than the window's web storage, which is what a browser would use. Web storage
 * belongs to an origin, and this client does not keep one: it is served from `localhost` while it is
 * being worked on and from `tauri://` once it is built, so anything kept in one is invisible to the
 * other — somebody would say where their Flux is, build the application, and be asked again.
 *
 * The application reads and writes without waiting, because a preference is read while something is
 * being drawn and nothing sensible can be drawn around a promise. So the file is read once before
 * anything else starts and held in memory, and a write goes to memory at once and to disk behind
 * it. A write that never reaches disk costs a preference; making every read wait would cost the
 * whole application.
 *
 * @returns The store, and the read that has to finish before it is installed.
 */
const theDesktopsStore = (): HeldStore => {
  const held = new Map<string, string>();
  let file: Awaited<ReturnType<typeof load>> | null = null;

  return {
    hydrate: async () => {
      try {
        file = await load(FILE, { autoSave: true, defaults: {} });

        for (const [key, value] of await file.entries()) {
          if (typeof value === 'string') {
            held.set(key, value);
          }
        }
      } catch {}
    },
    read: (key) => held.get(key) ?? null,
    write: (key, value) => {
      held.set(key, value);

      void file?.set(key, value);
    },
    forget: (key) => {
      held.delete(key);

      void file?.delete(key);
    },
  };
};

export type { HeldStore };

export { theDesktopsStore };
