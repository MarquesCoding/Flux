import type { MediaSummary } from '@FluxContracts/schemas/Library';

type Surprise = { kind: 'item'; item: MediaSummary } | { kind: 'show'; showId: string };

export type { Surprise };
