import type { MediaSummary } from '@ValenceContracts/schemas/Library';

/**
 * Chooses what somebody is likely to want next from a pool of candidates, by how far each shares
 * the genres they lean towards — the genre they like most counting for most — and leaves out
 * anything they have already seen or kept, which is not a suggestion. Where two score the same, the
 * better-rated goes first.
 *
 * @param candidates - What there is to choose from.
 * @param taste - Their genres, most-liked first, as `tasteOf` reads them.
 * @param seen - What they have already watched, kept or rated, which is not worth suggesting.
 * @param limit - How many to choose.
 * @returns The choices, best first.
 */
const pickForYou = (
  candidates: readonly MediaSummary[],
  taste: readonly string[],
  seen: ReadonlySet<string>,
  limit: number,
): MediaSummary[] => {
  const weight = new Map(taste.map((genre, at) => [genre, taste.length - at]));
  const scored = new Map<string, { media: MediaSummary; score: number }>();

  for (const media of candidates) {
    if (seen.has(media.id) || scored.has(media.id)) {
      continue;
    }

    const score = (media.genres ?? []).reduce((sum, genre) => sum + (weight.get(genre) ?? 0), 0);

    if (score > 0) {
      scored.set(media.id, { media, score: score + (media.rating ?? 0) / 100 });
    }
  }

  return [...scored.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ media }) => media);
};

export { pickForYou };
