import CatalogueMetadataProviderModule from '@FluxServer/library/createCatalogueMetadataProvider'

const { isAccessToken } = CatalogueMetadataProviderModule

/**
 * Where the catalogue lives.
 *
 * Kept in step with `createCatalogueMetadataProvider`'s own default rather
 * than imported from it, since that module does not export its constant —
 * both point at the same place regardless.
 */
const DEFAULT_BASE_URL = 'https://api.themoviedb.org/3'

type Fetcher = (
  url: string,
  headers?: Record<string, string>,
) => Promise<{ ok: boolean; status: number }>

type CheckCatalogueConnectivityOptions = {
  /**
   * Read at call time, the same reason `createCatalogueMetadataProvider`
   * does: an operator changing the key in settings should not need to
   * restart the server to have this check try the new one.
   */
  readApiKey: () => Promise<string | null>
  baseUrl?: string
  fetchImpl?: Fetcher
}

/**
 * Verifies the configured catalogue key can actually reach the catalogue,
 * rather than only checking that a key is stored.
 *
 * `hasCatalogueKey` on the admin overview answers the second question, and
 * always has — a key that is present but wrong, revoked or rate-limited
 * looks identical to one that works right up until a scan tries to use it.
 * This is the same question asked deliberately, on demand, against a
 * request cheap enough to run just to find out.
 */
const checkCatalogueConnectivity = async ({
  readApiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl,
}: CheckCatalogueConnectivityOptions): Promise<boolean> => {
  const call: Fetcher =
    fetchImpl ??
    (async (url, headers) => {
      const response = await fetch(url, headers === undefined ? {} : { headers })

      return { ok: response.ok, status: response.status }
    })

  const key = await readApiKey()

  if (key === null || key === '') {
    return false
  }

  const isToken = isAccessToken(key)
  const query = new URLSearchParams(isToken ? {} : { api_key: key })

  const response = await call(
    `${baseUrl}/authentication?${query.toString()}`,
    isToken ? { authorization: `Bearer ${key}` } : undefined,
  ).catch(() => ({ ok: false, status: 0 }))

  return response.ok
}

export default { checkCatalogueConnectivity }
