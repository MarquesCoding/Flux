type AddedItem = {
  id: string;
  title: string;
  seriesId: string | null;
  seriesTitle: string | null;
};

type NewMediaSummary = {
  title: string;
  body: string;
  link: string | null;
};

const NAMED_AT_MOST = 3;

/**
 * Joins a list of names the way somebody writing the sentence would — commas between, "and" before
 * the last — so a notification reads as English rather than as a list.
 *
 * @param names - The names to join.
 * @returns The names as a phrase.
 */
const inWords = (names: string[]): string => {
  const shown = names.slice(0, NAMED_AT_MOST);
  const rest = names.length - shown.length;
  const listed =
    shown.length <= 1
      ? (shown[0] ?? '')
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1] ?? ''}`;

  return rest === 0 ? listed : `${listed} and ${rest.toString()} more`;
};

/**
 * Turns everything imported in a window into one thing worth saying.
 *
 * @param items Everything imported since the last digest.
 */
const summariseNewMedia = (items: AddedItem[]): NewMediaSummary | null => {
  if (items.length === 0) {
    return null;
  }

  const films = items.filter((item) => item.seriesId === null);
  const episodes = items.filter((item) => item.seriesId !== null);
  const series = new Map<string, { title: string; count: number }>();

  for (const episode of episodes) {
    const id = episode.seriesId ?? '';
    const held = series.get(id);

    series.set(id, {
      title: held?.title ?? episode.seriesTitle ?? episode.title,
      count: (held?.count ?? 0) + 1,
    });
  }

  const programmes = [...series.values()];
  const names = [...programmes.map((one) => one.title), ...films.map((film) => film.title)];

  const only = films.length === 1 && programmes.length === 0 ? films[0] : null;
  const onlySeries =
    programmes.length === 1 && films.length === 0 ? [...series.keys()][0] : undefined;

  const episodeWords =
    episodes.length === 0
      ? []
      : [`${episodes.length.toString()} ${episodes.length === 1 ? 'episode' : 'episodes'}`];

  const filmWords =
    films.length === 0
      ? []
      : [`${films.length.toString()} ${films.length === 1 ? 'film' : 'films'}`];

  return {
    title: 'Something new to watch',
    body: `${[...episodeWords, ...filmWords].join(' and ')} — ${inWords(names)}`,
    link:
      only !== undefined && only !== null
        ? `/?inspecting=${only.id}`
        : onlySeries === undefined
          ? null
          : `/?show=${onlySeries}`,
  };
};

export { summariseNewMedia };

export type { AddedItem };
