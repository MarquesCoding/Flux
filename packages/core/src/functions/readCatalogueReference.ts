type CatalogueKind = 'tv' | 'movie';

type CatalogueReference = {
  id: string;
  kind: CatalogueKind | null;
};

/**
 * What somebody pasted, read as a catalogue reference.
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
