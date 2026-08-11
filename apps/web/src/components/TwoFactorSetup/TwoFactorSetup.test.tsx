import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TwoFactorSetup } from './TwoFactorSetup'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const OTP_URI = 'otpauth://totp/Flux:admin@flux.test?secret=JBSWY3DPEHPK3PXP&issuer=Flux'

const BACKUP_CODES = ['aaaa-1111', 'bbbb-2222']

const enrollmentResponse = {
  ok: true,
  status: 200,
  json: () => Promise.resolve({ totpURI: OTP_URI, backupCodes: BACKUP_CODES }),
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(enrollmentResponse)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const startEnrollment = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.click(screen.getByRole('button', { name: 'Set up two-factor' }))
  await actor.type(screen.getByLabelText('Password'), 'a-long-enough-password')
  await actor.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('TwoFactorSetup when disabled', () => {
  it('offers to set up two-factor', () => {
    render(<TwoFactorSetup isEnabled={false} onChanged={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Set up two-factor' })).toBeInTheDocument()
  })

  it('asks for the password before revealing a secret', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={vi.fn()} />)

    await actor.click(screen.getByRole('button', { name: 'Set up two-factor' }))

    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the qr code, the key as text, and the backup codes', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={vi.fn()} />)

    await startEnrollment(actor)

    expect(await screen.findByRole('img', { name: 'Two-factor setup QR code' })).toBeInTheDocument()
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeInTheDocument()
    expect(screen.getByText('aaaa-1111')).toBeInTheDocument()
    expect(screen.getByText('bbbb-2222')).toBeInTheDocument()
  })

  it('reports a wrong password without revealing a secret', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={vi.fn()} />)

    await startEnrollment(actor)

    expect(await screen.findByRole('alert')).toHaveTextContent('password is incorrect')
    expect(screen.queryByRole('img', { name: 'Two-factor setup QR code' })).not.toBeInTheDocument()
  })

  it('does not enable until a generated code is confirmed', async () => {
    const onChanged = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={onChanged} />)

    await startEnrollment(actor)
    await screen.findByRole('img', { name: 'Two-factor setup QR code' })

    expect(onChanged).not.toHaveBeenCalled()
  })

  it('rejects a confirmation code that is not six digits', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={vi.fn()} />)

    await startEnrollment(actor)
    await screen.findByRole('img', { name: 'Two-factor setup QR code' })

    fetchMock.mockClear()
    await actor.type(screen.getByLabelText('Authenticator code'), '12')
    await actor.click(screen.getByRole('button', { name: 'Turn on two-factor' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('6 digits')
  })

  it('completes enrollment when the code is accepted', async () => {
    const onChanged = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={onChanged} />)

    await startEnrollment(actor)
    await screen.findByRole('img', { name: 'Two-factor setup QR code' })

    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Turn on two-factor' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/two-factor/verify-totp', expect.anything())
    })
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('does not complete enrollment when the code is rejected', async () => {
    const onChanged = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled={false} onChanged={onChanged} />)

    await startEnrollment(actor)
    await screen.findByRole('img', { name: 'Two-factor setup QR code' })

    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    await actor.type(screen.getByLabelText('Authenticator code'), '123456')
    await actor.click(screen.getByRole('button', { name: 'Turn on two-factor' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('not valid')
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('TwoFactorSetup when enabled', () => {
  it('offers to turn two-factor off', () => {
    render(<TwoFactorSetup isEnabled onChanged={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Turn off two-factor' })).toBeInTheDocument()
  })

  it('requires the password to turn it off', async () => {
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled onChanged={vi.fn()} />)

    await actor.click(screen.getByRole('button', { name: 'Turn off two-factor' }))

    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to the disable endpoint', async () => {
    const onChanged = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled onChanged={onChanged} />)

    await actor.click(screen.getByRole('button', { name: 'Turn off two-factor' }))
    await actor.type(screen.getByLabelText('Password'), 'a-long-enough-password')
    await actor.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/two-factor/disable', expect.anything())
    })
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('does not turn it off when the password is wrong', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    const onChanged = vi.fn()
    const actor = userEvent.setup()
    render(<TwoFactorSetup isEnabled onChanged={onChanged} />)

    await actor.click(screen.getByRole('button', { name: 'Turn off two-factor' }))
    await actor.type(screen.getByLabelText('Password'), 'wrong-password')
    await actor.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('password is incorrect')
    expect(onChanged).not.toHaveBeenCalled()
  })
})
