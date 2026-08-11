import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JsonValueModule from '@FluxContracts/schemas/JsonValue'
import fetchProfilesModule from './fetchProfiles'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { JsonValueSchema } = JsonValueModule
const { fetchProfiles, createProfile, saveProfile, removeProfile, uploadProfilePhoto } =
  fetchProfilesModule

type Answer = { ok: boolean; json: () => Promise<JsonValue> }

type FetchLike = (input: string, init?: RequestInit) => Promise<Answer>

const fetchMock = vi.fn<FetchLike>()

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/**
 * The body of the last request, as it was sent.
 */
const sentBody = (): JsonValue => {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body

  return JsonValueSchema.parse(JSON.parse(typeof body === 'string' ? body : 'null'))
}

const answerWith = (body: JsonValue, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  fetchMock.mockReset()
  answerWith({ profiles: [] })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchProfiles', () => {
  it('reads the people using this account', async () => {
    answerWith({ profiles: [PROFILE] })

    await expect(fetchProfiles()).resolves.toEqual([PROFILE])
  })

  it('shows nobody rather than failing when the server refuses', async () => {
    answerWith({}, false)

    await expect(fetchProfiles()).resolves.toEqual([])
  })

  it('shows nobody rather than failing when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(fetchProfiles()).resolves.toEqual([])
  })

  it('shows nobody rather than throwing on an answer it cannot read', async () => {
    answerWith({ profiles: [{ id: 'not a profile' }] })

    await expect(fetchProfiles()).resolves.toEqual([])
  })
})

describe('createProfile', () => {
  it('adds somebody to this account', async () => {
    await createProfile('Sam', '#3ac47d')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiles',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not name a picture that was not chosen', async () => {
    await createProfile('Sam', '#3ac47d')

    expect(sentBody()).toEqual({ name: 'Sam', colour: '#3ac47d' })
  })

  it('sends the picture that was chosen', async () => {
    await createProfile('Sam', '#3ac47d', { kind: 'drawn', style: 'bottts', seed: 'abc' })

    expect(sentBody()).toMatchObject({ avatar: { kind: 'drawn' } })
  })

  it('reports failure rather than pretending somebody was added', async () => {
    answerWith({}, false)

    await expect(createProfile('Sam', '#3ac47d')).resolves.toBe(false)
  })

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(createProfile('Sam', '#3ac47d')).resolves.toBe(false)
  })
})

describe('saveProfile', () => {
  it('changes the profile it was given, and no other', async () => {
    await saveProfile('abc', 'Sam', '#3ac47d')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiles/abc',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('leaves the picture alone when none was chosen', async () => {
    await saveProfile('abc', 'Sam', '#3ac47d')

    expect(sentBody()).toEqual({ name: 'Sam', colour: '#3ac47d' })
  })

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(saveProfile('abc', 'Sam', '#3ac47d')).resolves.toBe(false)
  })
})

describe('uploadProfilePhoto', () => {
  it('sends the picture itself rather than a form around it', async () => {
    const file = new File(['picture'], 'me.webp', { type: 'image/webp' })

    await uploadProfilePhoto('abc', file)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiles/abc/photo',
      expect.objectContaining({ method: 'PUT', body: file }),
    )
  })

  it('says what kind of picture it is, since a moving one is not an image', async () => {
    await uploadProfilePhoto('abc', new File(['clip'], 'me.webm', { type: 'video/webm' }))

    expect(fetchMock.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      'content-type': 'video/webm',
    })
  })

  it('reports failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(
      uploadProfilePhoto('abc', new File(['picture'], 'me.webp', { type: 'image/webp' })),
    ).resolves.toBe(false)
  })
})

describe('removeProfile', () => {
  it('removes somebody from this account', async () => {
    await removeProfile('abc')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profiles/abc',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('reports failure rather than pretending somebody was removed', async () => {
    answerWith({}, false)

    await expect(removeProfile('abc')).resolves.toBe(false)
  })
})
