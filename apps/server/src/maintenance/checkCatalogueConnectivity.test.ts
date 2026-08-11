import { describe, expect, it } from 'vitest'
import checkCatalogueConnectivityModule from './checkCatalogueConnectivity'

const { checkCatalogueConnectivity } = checkCatalogueConnectivityModule

describe('checkCatalogueConnectivity', () => {
  it('is unreachable when no key is configured', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve(null),
      fetchImpl: () => Promise.reject(new Error('should not be called')),
    })

    expect(reachable).toBe(false)
  })

  it('sends an older key as a query parameter', async () => {
    let seenUrl = ''

    await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a1b2c3'),
      fetchImpl: (url) => {
        seenUrl = url

        return Promise.resolve({ ok: true, status: 200 })
      },
    })

    expect(seenUrl).toContain('api_key=a1b2c3')
  })

  it('sends a newer access token as a bearer header', async () => {
    let seenHeaders: Record<string, string> | undefined

    await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('eyabc.def.ghi'),
      fetchImpl: (_url, headers) => {
        seenHeaders = headers

        return Promise.resolve({ ok: true, status: 200 })
      },
    })

    expect(seenHeaders).toEqual({ authorization: 'Bearer eyabc.def.ghi' })
  })

  it('is reachable when the catalogue answers ok', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-key'),
      fetchImpl: () => Promise.resolve({ ok: true, status: 200 }),
    })

    expect(reachable).toBe(true)
  })

  it('is unreachable when the catalogue refuses the key', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-bad-key'),
      fetchImpl: () => Promise.resolve({ ok: false, status: 401 }),
    })

    expect(reachable).toBe(false)
  })

  it('is unreachable rather than throwing when the catalogue cannot be reached at all', async () => {
    const reachable = await checkCatalogueConnectivity({
      readApiKey: () => Promise.resolve('a-key'),
      fetchImpl: () => Promise.reject(new Error('network down')),
    })

    expect(reachable).toBe(false)
  })
})
