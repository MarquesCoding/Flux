/**
 * What is known about which programme a file belongs to.
 */
type SeriesEvidence = {
  /**
   * What a catalogue calls the programme this episode is from.
   *
   * The programme's id, not the episode's — an episode is matched by searching
   * for its series, so this is the same string for every episode of it. That is
   * what makes it usable as identity.
   */
  externalId: string | null;
  /**
   * The directory that holds the programme, as a path.
   */
  seriesFolder: string | null;
  seriesTitle: string | null;
};

/**
 * Works out which programme a file belongs to, as a key that survives being
 * renamed.
 *
 * A title cannot do this job. Two programmes share one — The Office, Shameless,
 * Skins, Being Human, The Bridge, and every remake ever made — so keying on the
 * title puts both of them in one group. That is not a hypothetical: intro
 * detection compares the audio of everything in a group, so two unrelated
 * programmes were being fingerprinted as one season and whatever it found was
 * written to both.
 *
 * Nor is a title stable. It is rewritten on every scan from whatever the
 * catalogue answered, so correcting a bad match changes it — and anything keyed
 * on the old string quietly detaches from the thing it was about. A hidden
 * programme, a rating, a parental exception: all pointing at a name nobody has
 * any more.
 *
 * So: the catalogue's id where there is one, because it is the same for every
 * episode of a programme and unaffected by what anybody calls it. Failing that
 * the folder, because a directory is what actually separates two same-named
 * programmes on disk — it is how the person who filed them told them apart, and
 * it survives a retitle for the same reason.
 *
 * Failing both, the title, lowercased. It is the weak answer and it is only
 * reached by a loose file with no folder of its own and no catalogue match,
 * which is the case where there is genuinely nothing better to go on.
 *
 * Returns nothing for a film. A film is not a series of one, and giving it a
 * series row would put every unmatched film in a library into one programme.
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
