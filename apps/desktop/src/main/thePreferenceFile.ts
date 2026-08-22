import Conf from 'conf';

let opened: Conf<Record<string, string>> | null = null;

type PreferenceFile = {
  all: () => Record<string, string>;

  read: (key: string) => string | null;
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
 * say where their Valence is, build the application, and be asked all over again.
 *
 * Opened once. Every request leaving this client asks where the server is, and opening the file to
 * answer would mean reading and parsing it from disk for every image, every subtitle and every
 * segment of everything anybody watches.
 *
 * A dot in a key is part of the key. The library reads one as a path by default, so
 * `valence.server.address` became three nested objects and came back as nothing at all — which is every
 * preference Valence has, and which meant this client forgot where its server was the moment it was
 * told.
 *
 * @returns The file, as three things the rest of the process can do to it.
 */
const thePreferenceFile = (): PreferenceFile => {
  opened ??= new Conf<Record<string, string>>({
    projectName: 'valence',
    configName: 'preferences',
    accessPropertiesByDotNotation: false,
  });

  const held = opened;

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
    read: (key) => {
      const value = held.get(key);

      return typeof value === 'string' ? value : null;
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
