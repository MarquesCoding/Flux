import type { MediaSummary } from '@ValenceContracts/schemas/Library';

type Surprise = { kind: 'item'; item: MediaSummary } | { kind: 'show'; showId: string };

export type { Surprise };
