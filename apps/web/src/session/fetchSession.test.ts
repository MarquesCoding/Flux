import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fetchSessionModule from './fetchSession'

const { fetchSession } = fetchSessionModule

const fetchMock = vi.fn()

const user = {
  id: 'usr_1',
  name: 'Operator',
  email: 'admin@flux.test',
  emailVerified: false,
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSession', () => {
  it('returns null when the body is null', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) })

    await expect(fetchSession()).resolves.toBeNull()
  })

  it('returns the user when signed in', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user, session: { token: 'abc' } }),
    })

    await expect(fetchSession()).resolves.toMatchObject({ email: 'admin@flux.test' })
  })

  it('throws when the server errors, so a down server is not read as signed out', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve(null) })

    await expect(fetchSession()).rejects.toThrow(/500/)
  })

  it('throws when the request cannot be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(fetchSession()).rejects.toThrow('offline')
  })

  it('throws when the body does not match the contract', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ user: { id: 'usr_1' } }),
    })

    await expect(fetchSession()).rejects.toThrow()
  })
})
