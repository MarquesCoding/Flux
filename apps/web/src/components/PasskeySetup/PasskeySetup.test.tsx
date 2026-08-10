import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PasskeySetupModule from './PasskeySetup'

const { PasskeySetup } = PasskeySetupModule

const registerPasskeyMock = vi.hoisted(() => vi.fn())
const listPasskeysMock = vi.hoisted(() => vi.fn())
const deletePasskeyMock = vi.hoisted(() => vi.fn())
const describeUnavailabilityMock = vi.hoisted(() => vi.fn())

vi.mock('@FluxWeb/passkeys/registerPasskey', () => ({
  default: { registerPasskey: registerPasskeyMock },
}))

vi.mock('@FluxWeb/passkeys/listPasskeys', () => ({
  default: { listPasskeys: listPasskeysMock, deletePasskey: deletePasskeyMock },
}))

vi.mock('@FluxWeb/passkeys/isPasskeySupported', () => ({
  default: {
    isPasskeySupported: () => describeUnavailabilityMock() === null,
    describePasskeyUnavailability: describeUnavailabilityMock,
  },
}))

beforeEach(() => {
  registerPasskeyMock.mockReset()
  listPasskeysMock.mockReset()
  deletePasskeyMock.mockReset()
  describeUnavailabilityMock.mockReset()

  registerPasskeyMock.mockResolvedValue({ kind: 'registered' })
  listPasskeysMock.mockResolvedValue([])
  deletePasskeyMock.mockResolvedValue(true)
  describeUnavailabilityMock.mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PasskeySetup when available', () => {
  it('reports when there are no passkeys yet', async () => {
    render(<PasskeySetup />)

    expect(await screen.findByText('No passkeys yet.')).toBeInTheDocument()
  })

  it('lists registered passkeys by name', async () => {
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: 'Laptop' }])
    render(<PasskeySetup />)

    expect(await screen.findByText('Laptop')).toBeInTheDocument()
  })

  it('falls back to a label for an unnamed passkey', async () => {
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: null }])
    render(<PasskeySetup />)

    expect(await screen.findByText('Unnamed passkey')).toBeInTheDocument()
  })

  it('registers a passkey with the chosen name', async () => {
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('No passkeys yet.')
    await actor.clear(screen.getByLabelText('Passkey name'))
    await actor.type(screen.getByLabelText('Passkey name'), 'Work phone')
    await actor.click(screen.getByRole('button', { name: /Add a passkey/ }))

    await waitFor(() => {
      expect(registerPasskeyMock).toHaveBeenCalledWith('Work phone')
    })
  })

  it('uses a default name when the field is cleared', async () => {
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('No passkeys yet.')
    await actor.clear(screen.getByLabelText('Passkey name'))
    await actor.click(screen.getByRole('button', { name: /Add a passkey/ }))

    await waitFor(() => {
      expect(registerPasskeyMock).toHaveBeenCalledWith('This device')
    })
  })

  it('refreshes the list after registering', async () => {
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('No passkeys yet.')
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: 'Laptop' }])
    await actor.click(screen.getByRole('button', { name: /Add a passkey/ }))

    expect(await screen.findByText('Laptop')).toBeInTheDocument()
  })

  it('says nothing when the user dismisses the device prompt', async () => {
    registerPasskeyMock.mockResolvedValue({ kind: 'cancelled' })
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('No passkeys yet.')
    await actor.click(screen.getByRole('button', { name: /Add a passkey/ }))

    await waitFor(() => {
      expect(registerPasskeyMock).toHaveBeenCalledOnce()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a failure', async () => {
    registerPasskeyMock.mockResolvedValue({ kind: 'failed', reason: 'The server said no.' })
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('No passkeys yet.')
    await actor.click(screen.getByRole('button', { name: /Add a passkey/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The server said no.')
  })

  it('removes a passkey', async () => {
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: 'Laptop' }])
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('Laptop')
    await actor.click(screen.getByRole('button', { name: /Remove/ }))

    await waitFor(() => {
      expect(deletePasskeyMock).toHaveBeenCalledWith('pk_1')
    })
  })

  it('reports a failed removal', async () => {
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: 'Laptop' }])
    deletePasskeyMock.mockResolvedValue(false)
    const actor = userEvent.setup()
    render(<PasskeySetup />)

    await screen.findByText('Laptop')
    await actor.click(screen.getByRole('button', { name: /Remove/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be removed')
  })

  it('reports a list that could not be loaded', async () => {
    listPasskeysMock.mockRejectedValue(new Error('offline'))
    render(<PasskeySetup />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your passkeys')
  })
})

describe('PasskeySetup when unavailable', () => {
  it('explains why instead of offering a button that cannot work', async () => {
    describeUnavailabilityMock.mockReturnValue(
      'Passkeys need a secure connection. Reach Flux over HTTPS, or on localhost, to add one.',
    )
    render(<PasskeySetup />)

    expect(await screen.findByText(/need a secure connection/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add a passkey/ })).not.toBeInTheDocument()
  })

  it('still lists passkeys registered from a secure context', async () => {
    describeUnavailabilityMock.mockReturnValue('Passkeys need a secure connection.')
    listPasskeysMock.mockResolvedValue([{ id: 'pk_1', name: 'Laptop' }])
    render(<PasskeySetup />)

    expect(await screen.findByText('Laptop')).toBeInTheDocument()
  })
})
