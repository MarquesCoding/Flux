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
    /**
     * The directory that separates this programme from another of the same
     * name, where the path had one.
     *
     * Optional because a provider is free to ignore it — nothing here needs it
     * to name a title. It is carried so that what the scanner learned from the
     * path reaches the same place everything else about the episode does,
     * rather than a second shape existing that is almost this one.
     */
    seriesFolder?: string | null;
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
  /**
   * Which catalogue that id belongs to, when somebody has said.
   *
   * Only set by a correction. Left out, a provider infers it the way it always
   * has — from whether the path looks like an episode — which is right until
   * somebody tells it that a file it read as an episode is a film.
   */
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
   * The title drawn as artwork, with a transparent background.
   *
   * A programme's name is usually set in lettering of its own, and a hero
   * that renders it in the interface's typeface is a hero that looks like a
   * database rather than like the thing it is showing.
   */
  logoUrl?: string;
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
/**
 * What a catalogue says a whole series contains.
 */
/**
 * One thing the catalogue offers as a possible answer.
 */
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
    /**
     * What each episode is called and what it looks like, so one nobody holds
     * can still be read about.
     */
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
  /**
   * How many episodes each season of a series has, asked by the id this
   * provider gave for it.
   *
   * Optional, because a provider that reads filenames can only ever describe
   * what is already there. Only a catalogue knows what is missing, which is
   * the whole reason this exists.
   */
  describeSeries?: (externalId: string) => Promise<SeriesShape | null>;
  /**
   * Finds the title drawn as artwork for something already identified.
   *
   * Separate from `describe` because it is asked separately: a logo is fetched
   * by a job of its own long after a scan named the thing, and re-running a
   * whole description to collect one image would re-probe, re-search and
   * re-rate every item to get it.
   *
   * Optional, because a provider that reads filenames has no artwork to give.
   */
  readLogoUrl?: (options: { externalId: string; isSeries: boolean }) => Promise<string | null>;
  /**
   * What the catalogue holds under a name, for somebody choosing by hand.
   *
   * Only a catalogue can answer. A provider that reads filenames knows nothing
   * beyond the files it was given, which is exactly why a human is being asked.
   */
  search?: (query: string, kind: 'tv' | 'movie') => Promise<CatalogueMatch[]>;
};

/**
 * Asks each provider in turn what a series should contain.
 *
 * The same order and the same forgiveness as `resolveMetadata`: a catalogue
 * being down means a series whose shape is unknown, never a series that fails
 * to open.
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

export type { CastMember, CatalogueMatch, MediaFacts, Metadata, MetadataProvider, SeriesShape };

export { resolveMetadata, resolveSeriesShape };
