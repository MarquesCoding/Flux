import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';

type MediaFacts = {
  path: string;
  probe: MediaProbe;
  episode?: {
    seriesTitle: string | null;
    seriesYear?: number | null;
    seriesFolder?: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    episodeTitle?: string | null;
  };
  knownExternalId?: string | null;
  knownExternalKind?: 'tv' | 'movie';
};

type CastMember = {
  name: string;
  role: string;
  imageUrl: string | null;
};

type Metadata = {
  title: string;
  year: number | null;
  overview?: string;
  tagline?: string;
  genres?: string[];
  cast?: CastMember[];
  rating?: number;
  seriesTitle?: string;
  posterUrl?: string;
  backdropUrl?: string;
  logoUrl?: string;
  externalId?: string;
};

type CatalogueMatch = {
  externalId: string;
  kind: 'tv' | 'movie';
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
};

type SeriesShape = {
  seasons: {
    seasonNumber: number;
    episodeCount: number;
    episodes: {
      episodeNumber: number;
      title: string;
      stillUrl: string | null;
      overview: string | null;
    }[];
  }[];
};

type MetadataProvider = {
  name: string;
  describe: (facts: MediaFacts) => Promise<Metadata | null>;
  describeSeries?: (externalId: string) => Promise<SeriesShape | null>;
  readLogoUrl?: (options: { externalId: string; isSeries: boolean }) => Promise<string | null>;
  search?: (query: string, kind: 'tv' | 'movie') => Promise<CatalogueMatch[]>;
};

/**
 * Asks each provider in turn what a series should contain.
 */
const resolveSeriesShape = async (
  providers: MetadataProvider[],
  externalId: string,
  onProblem?: (provider: string, reason: string) => void,
): Promise<SeriesShape | null> => {
  for (const provider of providers) {
    if (provider.describeSeries === undefined) {
      continue;
    }

    try {
      const found = await provider.describeSeries(externalId);

      if (found !== null) {
        return found;
      }
    } catch (error) {
      onProblem?.(provider.name, error instanceof Error ? error.message : 'Provider failed.');
    }
  }

  return null;
};

/**
 * Asks each provider in turn.
 */
const resolveMetadata = async (
  providers: MetadataProvider[],
  facts: MediaFacts,
  onProblem?: (provider: string, reason: string) => void,
): Promise<Metadata | null> => {
  for (const provider of providers) {
    try {
      const found = await provider.describe(facts);

      if (found !== null) {
        return found;
      }
    } catch (error) {
      onProblem?.(provider.name, error instanceof Error ? error.message : 'Provider failed.');
    }
  }

  return null;
};

export type { CastMember, CatalogueMatch, MediaFacts, Metadata, MetadataProvider, SeriesShape };

export { resolveMetadata, resolveSeriesShape };
