import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient';

type MediaFacts = {
  path: string;
  probe: MediaProbe;
  /**
   * What the path says about where this file sits in a series, when it says
   * anything. A provider searching a catalogue needs to know whether it is
   * looking for a film or an episode.
   */
  episode?: {
    seriesTitle: string | null;
    seriesYear?: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    episodeTitle?: string | null;
  };
  /**
   * What a provider previously said this item's id was, there.
   *
   * A rescan asks again by name from nothing, every time, unless told what it
   * already knew — and a name search is exactly what let this item get
   * mismatched in the first place. Given the id, a provider can go straight
   * to the thing it already found instead of searching for it again.
   */
  knownExternalId?: string | null;
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
  /**
   * Out of ten, as the catalogues that supply it report.
   */
  rating?: number;
  /**
   * The show an episode belongs to, when a provider knows it better than the
   * path did.
   */
  seriesTitle?: string;
  posterUrl?: string;
  backdropUrl?: string;
  /**
   * How the provider names this item, so a later lookup can skip searching.
   */
  externalId?: string;
};

/**
 * Where a title comes from.
 *
 * The extension point `MetadataProvider` plugins implement (ADR-0007). Flux
 * ships one provider that reads the filename, which is enough to browse a
 * library and no more; anything richer is a plugin's job, because it means
 * talking to a third-party service the operator should choose.
 *
 * Providers are asked in order and the first answer wins, so a plugin can
 * override the built-in without replacing it.
 */
type MetadataProvider = {
  name: string;
  describe: (facts: MediaFacts) => Promise<Metadata | null>;
};

/**
 * Asks each provider in turn.
 *
 * A provider that throws is skipped rather than failing the scan: a metadata
 * service being down must not stop a library from being readable.
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

export type { CastMember, MediaFacts, Metadata, MetadataProvider };

export { resolveMetadata };
