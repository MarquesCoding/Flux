import { isAccessToken } from '@ValenceServer/library/createCatalogueMetadataProvider';
const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3';

type Fetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ ok: boolean; status: number }>;

type CheckCatalogueConnectivityOptions = {
  readApiKey: () => Promise<string | null>;
  baseUrl?: string;
  fetchImpl?: Fetcher;
};

/**
 * Checks that the configured catalogue credential actually reaches the catalogue, rather than only
 * that a key is stored — so an operator finds out when they paste the wrong one, rather than when a
 * scan quietly files a thousand films under their filenames.
 *
 * @param options - The credential to try and how to reach the catalogue.
 * @returns Whether it worked, and what went wrong when it did not.
 */
const checkCatalogueConnectivity = async ({
  readApiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl,
}: CheckCatalogueConnectivityOptions): Promise<boolean> => {
  const call: Fetcher =
    fetchImpl ??
    (async (url, headers) => {
      const response = await fetch(url, headers === undefined ? {} : { headers });

      return { ok: response.ok, status: response.status };
    });

  const key = await readApiKey();

  if (key === null || key === '') {
    return false;
  }

  const isToken = isAccessToken(key);
  const query = new URLSearchParams(isToken ? {} : { api_key: key });

  const response = await call(
    `${baseUrl}/authentication?${query.toString()}`,
    isToken ? { authorization: `Bearer ${key}` } : undefined,
  ).catch(() => ({ ok: false, status: 0 }));

  return response.ok;
};

export { checkCatalogueConnectivity };
