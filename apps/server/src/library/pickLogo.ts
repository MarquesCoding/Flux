type LogoCandidate = {
  filePath: string;
  language: string | null;
  width: number;
  voteAverage: number;
};

/**
 * Ranks how much each kind of logo language is wanted, so the best available is chosen rather than
 * the first returned. A logo with no lettering at all beats one in a language nobody in the house
 * reads.
 *
 * @param language - The language a catalogue tagged the logo with.
 * @param wanted - The language the house reads.
 * @param original - The language the title was made in.
 * @returns How much it is preferred, lower being better.
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
 * Chooses which of a catalogue's logos to draw a title with, preferring the viewer's language, then
 * one with no lettering, then anything. A logo is the title as its designer set it, so getting the
 * language wrong is worse than showing plain text.
 *
 * @param candidates - The logos the catalogue offered, each with its language.
 * @param options - The language the house reads, and the one the title was made in.
 * @returns The logo to use, or null where none were offered.
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
