import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient'

type MediaFacts = {
  path: string
  probe: MediaProbe
}

type Metadata = {
  title: string
  year: number | null
  overview?: string
  posterUrl?: string
}

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
  name: string
  describe: (facts: MediaFacts) => Promise<Metadata | null>
}

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
      const found = await provider.describe(facts)

      if (found !== null) {
        return found
      }
    } catch (error) {
      onProblem?.(provider.name, error instanceof Error ? error.message : 'Provider failed.')
    }
  }

  return null
}

export type { MediaFacts, Metadata, MetadataProvider }

export default { resolveMetadata }
