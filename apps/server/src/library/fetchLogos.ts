/**
 * An item that has been named by a catalogue but has no lettering yet.
 */
type LogolessItem = {
  id: string;
  externalId: string;
  isSeries: boolean;
};

type FetchLogosOptions = {
  libraryId: string;
  store: {
    listMissing: (libraryId: string) => Promise<LogolessItem[]>;
    save: (mediaItemId: string, logoUrl: string) => Promise<void>;
  };
  /**
   * Where the lettering comes from.
   *
   * Absent when no catalogue is configured, or when the one that is cannot
   * supply artwork — in which case there is nothing to do rather than
   * something to fail at.
   */
  readLogoUrl?: (options: { externalId: string; isSeries: boolean }) => Promise<string | null>;
  onProblem?: (mediaItemId: string, reason: string) => void;
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => Promise<boolean> | boolean;
};

type FetchLogosResult = {
  found: number;
  missing: number;
};

/**
 * Collects the lettering each title is written in.
 *
 * A job of its own rather than part of a scan, for the same reason previews
 * are: a scan probes every file, asks a catalogue about each one and rates
 * them, and re-running all of that to collect one image per item would be
 * hours of work for a picture. This asks only about items a catalogue has
 * already named, and only about those that have no lettering yet, so running
 * it twice costs nothing the second time.
 *
 * One at a time rather than in parallel. Catalogues rate-limit by requests per
 * second and this is the least urgent thing Flux asks them for — a library
 * without logos is a library that draws its titles in the interface's own
 * typeface, which is a smaller problem than a library that has been refused
 * service.
 *
 * An item a catalogue has no lettering for is left alone rather than recorded
 * as failed. Plenty of things genuinely have none, and marking those as a
 * problem would fill an admin's log with the ordinary.
 */
const fetchLogos = async ({
  libraryId,
  store,
  readLogoUrl,
  onProblem,
  onProgress,
  isCancelled,
}: FetchLogosOptions): Promise<FetchLogosResult> => {
  if (readLogoUrl === undefined) {
    return { found: 0, missing: 0 };
  }

  const outstanding = await store.listMissing(libraryId);

  let found = 0;
  let missing = 0;

  onProgress?.(0, outstanding.length);

  for (const [at, item] of outstanding.entries()) {
    if ((await isCancelled?.()) === true) {
      break;
    }

    try {
      const url = await readLogoUrl({ externalId: item.externalId, isSeries: item.isSeries });

      if (url === null) {
        missing += 1;
      } else {
        await store.save(item.id, url);
        found += 1;
      }
    } catch (cause) {
      missing += 1;
      onProblem?.(
        item.id,
        cause instanceof Error ? cause.message : 'The catalogue did not answer.',
      );
    }

    onProgress?.(at + 1, outstanding.length);
  }

  return { found, missing };
};

export type { FetchLogosOptions, FetchLogosResult, LogolessItem };

export { fetchLogos };
