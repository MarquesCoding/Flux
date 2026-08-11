import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TwoFactorChallengeModule from './TwoFactorChallenge'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { TwoFactorChallenge } = TwoFactorChallengeModule

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const respondWith = (ok: boolean, status = ok ? 200 : 401) => {
  fetchMock.mockResolvedValue({ ok, status, json: () => Promise.resolve({}) })
}

beforeEach(() => {
  fetchMock.mockReset()
  respondWith(true)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TwoFactorChallenge', () => {
  it('asks for an authenticator code first', () => {
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    expect(screen.getByLabelText('Authenticator code')).toBeInTheDocument()
  })

  it('rejects a code that is not six digits without contacting the server', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('6 digits')
  })

  it('posts a valid code to the totp endpoint', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/two-factor/verify-totp', expect.anything())
    })
  })

  it('reports success to its parent', async () => {
    const onVerified = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={onVerified} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledOnce()
    })
  })

  it('does not sign in when the code is rejected', async () => {
    respondWith(false)
    const onVerified = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={onVerified} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('not valid')
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('switches to backup codes', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }))

    expect(screen.getByLabelText('Backup code')).toBeInTheDocument()
  })

  it('posts a backup code to the backup endpoint', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }))
    await actor.type(screen.getByLabelText('Backup code'), 'abcd-efgh')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/two-factor/verify-backup-code',
        expect.anything(),
      )
    })
  })

  it('does not apply the six digit rule to backup codes', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }))
    await actor.type(screen.getByLabelText('Backup code'), 'abcd-efgh')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce()
    })
  })

  it('clears a typed code when switching modes', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: /Use a backup code/ }))

    expect(screen.getByLabelText('Backup code')).toHaveValue('')
  })

  it('brings no way out of its own, since the screen around it has one', () => {
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Back to sign in/ })).not.toBeInTheDocument()
  })

  it('reports an unreachable server rather than failing silently', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const actor = userEvent.setup()
    render(<TwoFactorChallenge onVerified={vi.fn()} />)

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the server/)
  })
})
