type LogoCandidate = {
  filePath: string;
  language: string | null;
  width: number;
  voteAverage: number;
};

/**
 * How much each kind of language is preferred, lowest first.
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
