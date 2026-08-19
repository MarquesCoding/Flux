import Conf from 'conf';

type PreferenceFile = {
  all: () => Record<string, string>;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

/**
 * Where this client keeps what belongs to the machine rather than to the account — which server it
 * watches, which profile is watching, the quality somebody pinned.
 *
 * Held by the main process rather than by the window. A window's web storage belongs to an origin,
 * and this client does not keep one: it is served from a dev server while it is being worked on and
 * from a file once it is built, so anything kept in one is invisible to the other. Somebody would
 * say where their Flux is, build the application, and be asked all over again.
 *
 * @returns The file, as three things the rest of the process can do to it.
 */
const thePreferenceFile = (): PreferenceFile => {
  const held = new Conf<Record<string, string>>({
    projectName: 'flux',
    configName: 'preferences',
  });

  return {
    all: () => {
      const everything: Record<string, string> = {};

      for (const [key, value] of Object.entries(held.store)) {
        if (typeof value === 'string') {
          everything[key] = value;
        }
      }

      return everything;
    },
    write: (key, value) => {
      held.set(key, value);
    },
    forget: (key) => {
      held.delete(key);
    },
  };
};

export type { PreferenceFile };

export { thePreferenceFile };
