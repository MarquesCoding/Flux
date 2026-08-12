type CatalogueKind = 'tv' | 'movie';

type CatalogueReference = {
  id: string;
  /**
   * Which catalogue the id belongs to, when what was pasted said.
   *
   * The ids are only unique within a kind: the same number addresses unrelated
   * titles under films and under series. A bare number cannot say, so the
   * caller has to supply it from whatever it already knows about the file.
   */
  kind: CatalogueKind | null;
};

/**
 * What somebody pasted, read as a catalogue reference.
 *
 * Nobody copies `97546`. They copy the address bar, and the address bar says
 * `themoviedb.org/tv/97546-ted-lasso`. Reading the id out of whatever arrives
 * removes the one fiddly step from an otherwise obvious action, and the URL
 * carries the kind along with it, which a bare number cannot.
 *
 * Returns nothing when there is no id to be found, rather than guessing: a
 * reference that cannot be read is a typo, and repopulating a library from a
 * typo is worse than refusing.
 */
const readCatalogueReference = (pasted: string): CatalogueReference | null => {
  const trimmed = pasted.trim();

  if (trimmed === '') {
    return null;
  }

  const fromUrl = /(?:^|\/)(tv|movie)\/(\d+)/.exec(trimmed);

  if (fromUrl !== null) {
    const kind = fromUrl[1];
    const id = fromUrl[2];

    return kind === undefined || id === undefined
      ? null
      : { id, kind: kind === 'tv' ? 'tv' : 'movie' };
  }

  return /^\d+$/.test(trimmed) ? { id: trimmed, kind: null } : null;
};

export { readCatalogueReference };
export type { CatalogueKind, CatalogueReference };
