import type { MediaSummary } from '@FluxContracts/schemas/Library';

/**
 * Where the dice landed, and so where a viewer is taken.
 *
 * A programme and a film are different destinations rather than one kind with
 * a flag: a film opens at itself, and a programme opens at the programme —
 * never at whichever episode happened to be drawn out of it.
 */
type Surprise = { kind: 'item'; item: MediaSummary } | { kind: 'show'; showId: string };

export type { Surprise };
