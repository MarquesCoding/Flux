type SeriesEvidence = {
  externalId: string | null;
  seriesFolder: string | null;
  seriesTitle: string | null;
};

/**
 * Works out which programme a file belongs to, as a key that survives the file being renamed: the
 * catalogue's identifier where there is one, then the folder holding it, then the series title.
 * Renaming a file must not split a programme in two, and two programmes sharing a title must not be
 * merged into one.
 *
 * @param options - The catalogue identifier, the series folder and the series title, as far as each
 *   is known.
 * @returns The key to group by, or null where nothing identifies a programme at all.
 */
const resolveSeriesKey = ({
  externalId,
  seriesFolder,
  seriesTitle,
}: SeriesEvidence): string | null => {
  if (seriesTitle === null || seriesTitle === '') {
    return null;
  }

  if (externalId !== null && externalId !== '') {
    return `catalogue:${externalId}`;
  }

  if (seriesFolder !== null && seriesFolder !== '') {
    return `folder:${seriesFolder}`;
  }

  return `title:${seriesTitle.toLowerCase()}`;
};

export { resolveSeriesKey };
