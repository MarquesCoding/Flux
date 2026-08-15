import { isAccessToken } from '@FluxServer/library/createCatalogueMetadataProvider';
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
 * Verifies the configured catalogue key can actually reach the catalogue, rather than only checking
 * that a key is stored.
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
