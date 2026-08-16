type CatalogueKind = 'tv' | 'movie';

type CatalogueReference = {
  id: string;
  kind: CatalogueKind | null;
};

/**
 * Reads whatever somebody pasted into a correction box as a reference to a catalogue entry. Accepts
 * a full address, from which the kind and the id are both taken, or a bare number, where the kind
 * is unknown and has to be asked for separately.
 *
 * @param pasted - The address or identifier somebody pasted, with any surrounding space.
 * @returns The identifier and the kind where the paste said which, or null if it named nothing.
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
