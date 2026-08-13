/**
 * One logo as a catalogue offers it.
 */
type LogoCandidate = {
  filePath: string;
  language: string | null;
  width: number;
  voteAverage: number;
};

/**
 * How much each kind of language is preferred, lowest first.
 *
 * A logo with no language on it is lettering that carries no words — a mark, a
 * monogram — which reads correctly to everybody and is therefore second only
 * to one in the viewer's own language. Anything else is a title somebody
 * cannot read, and the programme's own tongue is the least bad of those
 * because it is at least the lettering the thing was made with.
 */
const rankLanguage = (language: string | null, wanted: string, original: string | null): number => {
  if (language === wanted) {
    return 0;
  }

  if (language === null) {
    return 1;
  }

  return language === original ? 2 : 3;
};

/**
 * Chooses the logo to draw a title with.
 *
 * Language first, then size, and the catalogue's own score only to break a
 * tie. That order is deliberate and is the opposite of how a poster would be
 * ranked: a logo is lettering, and lettering nobody can read is worthless
 * however well somebody rated it. The scores bear this out — a real programme
 * checked while writing this had four Japanese logos rated between 0.2 and
 * 3.3 on one to three votes, and two English ones rated nothing at all
 * because nobody had voted. Ranking by score would have drawn the English
 * title in Japanese on the strength of a single vote.
 *
 * Width second because a hero draws this across a third of a large screen, and
 * a six hundred pixel logo stretched to fill it looks like a mistake in a way
 * that a small poster never does.
 *
 * Returns nothing rather than guessing when there is nothing readable, so a
 * hero falls back to setting the title in the interface's own typeface.
 */
const pickLogo = (
  candidates: readonly LogoCandidate[],
  options: { language?: string; originalLanguage?: string | null } = {},
): LogoCandidate | null => {
  const wanted = options.language ?? 'en';
  const original = options.originalLanguage ?? null;

  const [best] = [...candidates].sort((left, right) => {
    const byLanguage =
      rankLanguage(left.language, wanted, original) -
      rankLanguage(right.language, wanted, original);

    if (byLanguage !== 0) {
      return byLanguage;
    }

    return right.width - left.width || right.voteAverage - left.voteAverage;
  });

  return best ?? null;
};

export type { LogoCandidate };

export { pickLogo, rankLanguage };
