import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPasskey } from './registerPasskey'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const startRegistrationMock = vi.hoisted(() => vi.fn())

vi.mock('@simplewebauthn/browser', () => ({ startRegistration: startRegistrationMock }))

type JsonRequestInit = Omit<RequestInit, 'body'> & { body?: string }

type FetchLike = (
  input: string,
  init?: JsonRequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const challenge = {
  challenge: 'Y2hhbGxlbmdl',
  rp: { name: 'Flux', id: 'localhost' },
  user: { id: 'dXNlcg', name: 'admin@flux.test', displayName: 'admin@flux.test' },
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
}

const attestation = { id: 'cred_1', rawId: 'cred_1', type: 'public-key', response: {} }

const namedError = (name: string) => {
  const error = new Error(name)
  error.name = name

  return error
}

beforeEach(() => {
  fetchMock.mockReset()
  startRegistrationMock.mockReset()
  startRegistrationMock.mockResolvedValue(attestation)
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      input === '/api/auth/passkey/generate-register-options'
        ? { ok: true, status: 200, json: () => Promise.resolve(challenge) }
        : { ok: true, status: 200, json: () => Promise.resolve({}) },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registerPasskey', () => {
  it('registers a passkey end to end', async () => {
    await expect(registerPasskey('Laptop')).resolves.toEqual({ kind: 'registered' })
  })

  it('sends the attestation and the chosen name to the server', async () => {
    await registerPasskey('Laptop')

    const verifyCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/auth/passkey/verify-registration',
    )

    expect(JSON.parse(verifyCall?.[1]?.body ?? '{}')).toMatchObject({
      response: { id: 'cred_1' },
      name: 'Laptop',
    })
  })

  it('reports a dismissed prompt as cancelled rather than an error', async () => {
    startRegistrationMock.mockRejectedValue(namedError('NotAllowedError'))

    await expect(registerPasskey('Laptop')).resolves.toEqual({ kind: 'cancelled' })
  })

  it('reports an aborted prompt as cancelled', async () => {
    startRegistrationMock.mockRejectedValue(namedError('AbortError'))

    await expect(registerPasskey('Laptop')).resolves.toEqual({ kind: 'cancelled' })
  })

  it('reports a device failure as a failure', async () => {
    startRegistrationMock.mockRejectedValue(namedError('NotSupportedError'))

    await expect(registerPasskey('Laptop')).resolves.toMatchObject({ kind: 'failed' })
  })

  it('does not start the ceremony when the server refuses to issue a challenge', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })

    await expect(registerPasskey('Laptop')).resolves.toMatchObject({ kind: 'failed' })
    expect(startRegistrationMock).not.toHaveBeenCalled()
  })

  it('does not start the ceremony when the challenge is malformed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ rp: { name: 'Flux' } }),
    })

    await expect(registerPasskey('Laptop')).resolves.toMatchObject({ kind: 'failed' })
    expect(startRegistrationMock).not.toHaveBeenCalled()
  })

  it('reports a server rejection of the attestation', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        input === '/api/auth/passkey/generate-register-options'
          ? { ok: true, status: 200, json: () => Promise.resolve(challenge) }
          : { ok: false, status: 400, json: () => Promise.resolve({}) },
      ),
    )

    await expect(registerPasskey('Laptop')).resolves.toEqual({
      kind: 'failed',
      reason: 'The server rejected the new passkey.',
    })
  })
})
