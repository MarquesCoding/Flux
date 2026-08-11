import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateWithPasskey } from './authenticateWithPasskey'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const startAuthenticationMock = vi.hoisted(() => vi.fn())

vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: startAuthenticationMock }))

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string }

type FetchLike = (
  input: string,
  init?: JsonRequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const challenge = { challenge: 'Y2hhbGxlbmdl', rpId: 'localhost', timeout: 60000 }

const assertion = { id: 'cred_1', rawId: 'cred_1', type: 'public-key', response: {} }

const namedError = (name: string) => {
  const error = new Error(name)
  error.name = name

  return error
}

beforeEach(() => {
  fetchMock.mockReset()
  startAuthenticationMock.mockReset()
  startAuthenticationMock.mockResolvedValue(assertion)
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      input === '/api/auth/passkey/generate-authenticate-options'
        ? { ok: true, status: 200, json: () => Promise.resolve(challenge) }
        : { ok: true, status: 200, json: () => Promise.resolve({}) },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authenticateWithPasskey', () => {
  it('signs in end to end', async () => {
    await expect(authenticateWithPasskey()).resolves.toEqual({ kind: 'signedIn' })
  })

  it('sends the assertion to the server', async () => {
    await authenticateWithPasskey()

    const verifyCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/auth/passkey/verify-authentication',
    )

    expect(JSON.parse(verifyCall?.[1]?.body ?? '{}')).toMatchObject({
      response: { id: 'cred_1' },
    })
  })

  it('never sends an email address', async () => {
    await authenticateWithPasskey()

    const verifyCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/auth/passkey/verify-authentication',
    )

    expect(verifyCall?.[1]?.body ?? '').not.toContain('@')
  })

  it('reports a dismissed prompt as cancelled', async () => {
    startAuthenticationMock.mockRejectedValue(namedError('NotAllowedError'))

    await expect(authenticateWithPasskey()).resolves.toEqual({ kind: 'cancelled' })
  })

  it('reports a device failure as a failure', async () => {
    startAuthenticationMock.mockRejectedValue(namedError('SecurityError'))

    await expect(authenticateWithPasskey()).resolves.toMatchObject({ kind: 'failed' })
  })

  it('does not prompt when the server refuses to issue a challenge', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })

    await expect(authenticateWithPasskey()).resolves.toMatchObject({ kind: 'failed' })
    expect(startAuthenticationMock).not.toHaveBeenCalled()
  })

  it('does not prompt when the challenge is malformed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rpId: 'localhost' }),
    })

    await expect(authenticateWithPasskey()).resolves.toMatchObject({ kind: 'failed' })
    expect(startAuthenticationMock).not.toHaveBeenCalled()
  })

  it('reports a rejected assertion', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        input === '/api/auth/passkey/generate-authenticate-options'
          ? { ok: true, status: 200, json: () => Promise.resolve(challenge) }
          : { ok: false, status: 400, json: () => Promise.resolve({}) },
      ),
    )

    await expect(authenticateWithPasskey()).resolves.toEqual({
      kind: 'failed',
      reason: 'That passkey was not accepted.',
    })
  })
})
