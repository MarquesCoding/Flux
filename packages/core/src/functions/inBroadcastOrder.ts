type Episode = {
  title: string;
  seasonNumber?: number | null | undefined;
  episodeNumber?: number | null | undefined;
};

/**
 * Orders episodes the way they are watched.
 *
 * @param left - One episode.
 * @param right - The episode to place it against.
 * @returns Negative when the left one comes first, as a sort comparator.
 */
const inBroadcastOrder = (left: Episode, right: Episode): number => {
  const season = (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0);

  if (season !== 0) {
    return season;
  }

  const episode = (left.episodeNumber ?? 0) - (right.episodeNumber ?? 0);

  return episode === 0 ? left.title.localeCompare(right.title) : episode;
};

export type { Episode };

export { inBroadcastOrder };
