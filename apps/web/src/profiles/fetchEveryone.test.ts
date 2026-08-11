import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JsonValueModule from '@FluxContracts/schemas/JsonValue'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'
import fetchEveryoneModule from './fetchEveryone'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { fetchEveryone, signInAsProfile } = fetchEveryoneModule

type Answer = { ok: boolean; json: () => Promise<JsonValue>; text?: () => Promise<string> }

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>

const { JsonValueSchema } = JsonValueModule

const fetchMock = vi.fn<FetchLike>()

/**
 * The body of the last request, as it was sent.
 */
const sentBody = (): JsonValue => {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body

  return JsonValueSchema.parse(JSON.parse(typeof body === 'string' ? body : 'null'))
}

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const answerWith = (body: string, ok = true) => {
  fetchMock.mockResolvedValue({
    ok,
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
  })
}

describe('fetchEveryone', () => {
  it('asks for everybody who could sign in', async () => {
    answerWith(JSON.stringify({ profiles: [PROFILE] }))

    await fetchEveryone()

    expect(fetchMock).toHaveBeenCalledWith('/api/profiles/everyone', expect.anything())
  })

  it('answers with the faces to show', async () => {
    answerWith(JSON.stringify({ profiles: [PROFILE] }))

    await expect(fetchEveryone()).resolves.toEqual([PROFILE])
  })

  it('answers with nobody when the server refuses', async () => {
    answerWith('{}', false)

    await expect(fetchEveryone()).resolves.toEqual([])
  })

  it('answers with nobody when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(fetchEveryone()).resolves.toEqual([])
  })

  it('answers with nobody rather than throwing on an answer that is not a list', async () => {
    answerWith(JSON.stringify({ profiles: 'everybody' }))

    await expect(fetchEveryone()).resolves.toEqual([])
  })
})

describe('signInAsProfile', () => {
  it('signs in as the face that was picked', async () => {
    answerWith('{}')

    await signInAsProfile('abc', 'a password')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiles/abc/sign-in',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('never sends an address, because the face is the account', async () => {
    answerWith('{}')

    await signInAsProfile('abc', 'a password')

    expect(sentBody()).toEqual({ password: 'a password' })
  })

  it('reports a session when the password was enough', async () => {
    answerWith('{}')

    await expect(signInAsProfile('abc', 'a password')).resolves.toEqual({ kind: 'signedIn' })
  })

  it('asks for a code when the password was right but not enough', async () => {
    answerWith(JSON.stringify({ twoFactorRedirect: true }))

    await expect(signInAsProfile('abc', 'a password')).resolves.toEqual({ kind: 'needsCode' })
  })

  it('says it was the password when it was', async () => {
    answerWith('{}', false)

    await expect(signInAsProfile('abc', 'wrong')).resolves.toEqual({
      kind: 'refused',
      reason: 'That password is not right.',
    })
  })

  it('says it was the server when it was', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(signInAsProfile('abc', 'a password')).resolves.toEqual({
      kind: 'refused',
      reason: 'Flux could not be reached.',
    })
  })

  it('treats an empty answer as a session rather than as a failure', async () => {
    answerWith('')

    await expect(signInAsProfile('abc', 'a password')).resolves.toEqual({ kind: 'signedIn' })
  })
})
