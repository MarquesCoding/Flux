/**
 * Enough about a newly imported item to write a sentence about it.
 */
type AddedItem = {
  id: string;
  title: string;
  /**
   * The programme it belongs to, or null for a film.
   */
  seriesId: string | null;
  seriesTitle: string | null;
};

/**
 * What a digest says, and where pressing it goes.
 */
type NewMediaSummary = {
  title: string;
  body: string;
  link: string | null;
};

/**
 * How many things a sentence names before it starts counting instead.
 *
 * Three, because "The Office, Taskmaster and Poirot" is a sentence somebody
 * reads and "The Office, Taskmaster, Poirot, Ghosts, Would I Lie To You and
 * 24 others" is a paragraph they skip. Past three, the count is the
 * information and the names are decoration.
 */
const NAMED_AT_MOST = 3;

/**
 * Joins names the way a person writing the sentence would.
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
 * This is the whole reason the household half could not simply reuse the
 * webhook path. A scan importing four hundred files raises four hundred
 * facts, and four hundred notifications is not a feature — it is the evening
 * somebody turns notifications off and never turns them back on.
 *
 * Episodes collapse into their programme, because a viewer thinks in
 * programmes: twelve files of one series is one thing arriving, said once,
 * with the count as the detail rather than the subject.
 *
 * The link is offered only where a single destination is honest — one
 * programme, or one film. A digest spanning several has nowhere to point, and
 * a notification that opens something arbitrary is worse than one that opens
 * nothing.
 *
 * Null where there is nothing to say, so a window in which nothing arrived
 * produces no notification rather than an empty one.
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

export { summariseNewMedia, NAMED_AT_MOST };

export type { AddedItem, NewMediaSummary };
