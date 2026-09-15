type Playing = {
  title: string;
  seriesTitle?: string | null | undefined;
  seasonNumber?: number | null | undefined;
  episodeNumber?: number | null | undefined;
  year?: number | null | undefined;
};

/**
 * Names what is playing, in the order somebody looking for it would say it: the programme, where in
 * it this is, what this one is called, and when it is from.
 *
 * An episode named by its own title alone is unidentifiable — half the television ever made has an
 * episode called Pilot — and a programme named without the episode is no better. Both are said,
 * separated rather than run together, so the eye can stop at whichever part it was looking for.
 *
 * The year is bracketed rather than separated, because it qualifies the thing immediately before it
 * rather than standing as a fact of its own. Anything missing is left out rather than drawn as a
 * gap: a film has no series and an unmatched item may have no year, and neither should read as
 * something having failed to load.
 *
 * @param media - What is playing.
 * @returns What to call it.
 */
const describePlaying = (media: Playing): string => {
  const named = media.title;

  const season = media.seasonNumber ?? null;
  const episode = media.episodeNumber ?? null;

  const where =
    season === null || episode === null ? null : `S${season.toString()}E${episode.toString()}`;

  const dated =
    media.year === null || media.year === undefined ? named : `${named} (${media.year.toString()})`;

  const series = media.seriesTitle ?? null;

  if (series === null) {
    return dated;
  }

  return [series, where, dated].filter((part) => part !== null).join(' · ');
};

export { describePlaying };
