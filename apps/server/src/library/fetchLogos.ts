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
