import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';
import type { Person } from '@FluxContracts/schemas/Person';

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
  personId: number | null;
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
  readPerson?: (personId: number) => Promise<Person | null>;
  search?: (query: string, kind: 'tv' | 'movie') => Promise<CatalogueMatch[]>;
};

/**
 * Asks each metadata provider in turn what a series is meant to contain, taking the first real
 * answer. This is what makes a missing episode visible: without a catalogue's own list, a season
 * that stops at episode nine and a season missing its tenth look identical.
 *
 * @param providers - The providers to ask, in order of preference.
 * @param externalId - The catalogue's identifier for the programme.
 * @param onProblem - Told when a provider fails, so a scan can report it without stopping.
 * @returns The shape of the series, or null where nobody could say.
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
 * Asks each metadata provider in turn about one file and takes the first real answer, so a plugin's
 * provider overrides the built-in filename reader without replacing it. A provider that fails is
 * skipped rather than failing the scan — a metadata service being down must not make a library
 * unreadable.
 *
 * @param providers - The providers to ask, in order of preference.
 * @param facts - What is known about the file from its path.
 * @param onProblem - Told when a provider fails.
 * @returns The metadata found, or an empty answer where nobody recognised the file.
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
