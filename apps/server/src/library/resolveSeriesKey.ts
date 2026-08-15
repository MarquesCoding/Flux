type SeriesEvidence = {
  externalId: string | null;
  seriesFolder: string | null;
  seriesTitle: string | null;
};

/**
 * Works out which programme a file belongs to, as a key that survives being renamed.
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

export type { SeriesEvidence };

export { resolveSeriesKey };
