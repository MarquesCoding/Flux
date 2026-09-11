const LABEL_EDGE = /^[\s._\-–—[\]()]+|[\s._\-–—[\]()]+$/g;

type FoundVersion = {
  parentPath: string;
  label: string;
};

/**
 * Drops a filename's extension, leaving a leading dot alone so that a hidden file does not become an
 * empty name.
 *
 * @param name - The filename.
 * @returns It without its extension.
 */
const stripExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');

  return lastDot > 0 ? name.slice(0, lastDot) : name;
};

/**
 * Splits a path into the folder holding a file and the file's own name.
 *
 * @param path - The file's path.
 * @returns Where it sits and what it is called.
 */
const partsOf = (path: string): { folder: string; name: string } => {
  const at = path.lastIndexOf('/');

  return at <= 0
    ? { folder: '', name: path }
    : { folder: path.slice(0, at), name: path.slice(at + 1) };
};

/**
 * Reads what one cut of a film is called, from whatever its filename says beyond the film's own
 * name — `Parasite (2019) - B&W.mkv` is the black and white one.
 *
 * @param stem - The filename without its extension.
 * @param base - The film's name, as the folder gives it.
 * @returns What to call this cut, or nothing where the name added none.
 */
const labelIn = (stem: string, base: string): string | null => {
  const said = stem.slice(base.length).replaceAll(LABEL_EDGE, '').trim();

  return said === '' ? null : said;
};

/**
 * Finds the films held as several files, one per cut, and says which cut each file is.
 *
 * A folder named for a film whose files all begin with that name is one film in several versions —
 * a theatrical cut and a director's, a colour print and a black and white one. This is how Jellyfin
 * reads the same shelf, and it is the only arrangement that says so unambiguously: files that merely
 * sit together are films that merely sit together.
 *
 * One of them has to be the film itself, since the others hang off a row rather than off a folder.
 * The one named exactly after the folder is taken where there is one, and otherwise the first by
 * name, so that the same shelf reads the same way on every scan.
 *
 * @param paths - Every media file in the library.
 * @param skip - The files already spoken for, which are extras rather than cuts of anything.
 * @returns Which film each version belongs to and what to call it, for the files that are versions.
 */
const groupVersions = (
  paths: readonly string[],
  skip: ReadonlySet<string> = new Set(),
): Map<string, FoundVersion> => {
  const byFolder = new Map<string, string[]>();

  for (const path of paths) {
    if (skip.has(path)) {
      continue;
    }

    const { folder } = partsOf(path);

    byFolder.set(folder, [...(byFolder.get(folder) ?? []), path]);
  }

  const found = new Map<string, FoundVersion>();

  for (const [folder, held] of byFolder) {
    const base = folder.slice(folder.lastIndexOf('/') + 1);

    if (held.length < 2 || base === '') {
      continue;
    }

    const named = held.filter((path) => stripExtension(partsOf(path).name).startsWith(base));

    if (named.length !== held.length) {
      continue;
    }

    const inOrder = [...named].sort((left, right) => left.localeCompare(right));
    const exact =
      inOrder.find((path) => stripExtension(partsOf(path).name) === base) ?? inOrder[0] ?? null;

    if (exact === null) {
      continue;
    }

    for (const path of inOrder) {
      const label = labelIn(stripExtension(partsOf(path).name), base);

      if (path === exact || label === null) {
        continue;
      }

      found.set(path, { parentPath: exact, label });
    }
  }

  return found;
};

export type { FoundVersion };

export { groupVersions };
