import type { MediaSummary } from '@ValenceContracts/schemas/Library';

/**
 * Reads which genres somebody leans towards from the things they have shown they like — kept,
 * rated well or watched — most-liked first, with ties settled alphabetically so the answer is the
 * same every time it is asked.
 *
 * @param liked - What they have shown they like.
 * @returns Their genres, most-liked first.
 */
const tasteOf = (liked: readonly MediaSummary[]): string[] => {
  const counts = new Map<string, number>();

  for (const media of liked) {
    for (const genre of media.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([genre]) => genre);
};

export { tasteOf };
