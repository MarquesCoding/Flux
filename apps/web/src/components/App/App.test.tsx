import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppModule from './App'
import type { JsonValue } from '@FluxContracts/schemas/JsonValue'

const { App } = AppModule

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json: () => Promise<JsonValue> }>

const fetchMock = vi.fn<FetchLike>()

const setupComplete = {
  isComplete: true,
  detectedOrigin: 'http://192.168.1.40:8420',
  isSecureContext: false,
  suggestedTrustedOrigins: ['http://192.168.1.40:8420'],
}

const user = {
  id: 'usr_1',
  name: 'Operator',
  email: 'admin@flux.test',
  emailVerified: false,
}

const ok = (body: JsonValue) => ({ ok: true, status: 200, json: () => Promise.resolve(body) })

/**
 * Routes the two endpoints the shell depends on, so tests describe server
 * state rather than call ordering.
 */
const serverState = (options: { setup: JsonValue; session: JsonValue }) => {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(input === '/api/setup/status' ? ok(options.setup) : ok(options.session)),
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App routing', () => {
  it('shows a spinner while loading', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    render(<App />)

    expect(screen.getByRole('status', { name: 'Loading Flux' })).toBeInTheDocument()
  })

  it('shows the setup wizard when setup is incomplete', async () => {
    serverState({ setup: { ...setupComplete, isComplete: false }, session: null })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Set up Flux' })).toBeInTheDocument()
  })

  it('does not ask for a session before setup is complete', async () => {
    serverState({ setup: { ...setupComplete, isComplete: false }, session: null })
    render(<App />)

    await screen.findByRole('heading', { name: 'Set up Flux' })

    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/get-session', expect.anything())
  })

  it('shows sign in when setup is complete but nobody is signed in', async () => {
    serverState({ setup: setupComplete, session: null })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in to Flux' })).toBeInTheDocument()
  })

  it('shows the library shell when signed in', async () => {
    serverState({ setup: setupComplete, session: { user } })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Flux' })).toBeInTheDocument()
    expect(screen.getByText(/Signed in as admin@flux.test/)).toBeInTheDocument()
  })

  it('renders a supplied title when signed in', async () => {
    serverState({ setup: setupComplete, session: { user } })
    render(<App initialTitle="Living Room" />)

    expect(await screen.findByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
  })

  it('reports an unreachable server rather than assuming setup is needed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Flux is not reachable' }),
    ).toBeInTheDocument()
  })

  it('does not show sign in when the session request fails', async () => {
    fetchMock.mockImplementation((input) =>
      input === '/api/setup/status'
        ? Promise.resolve(ok(setupComplete))
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) }),
    )
    render(<App />)

    await screen.findByRole('heading', { name: 'Flux is not reachable' })

    expect(screen.queryByRole('heading', { name: 'Sign in to Flux' })).not.toBeInTheDocument()
  })

  it('signs out and returns to the sign in screen', async () => {
    serverState({ setup: setupComplete, session: { user } })
    const actor = userEvent.setup()
    render(<App />)

    await screen.findByText(/Signed in as admin@flux.test/)

    serverState({ setup: setupComplete, session: null })
    await actor.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to Flux' })).toBeInTheDocument()
  })
})
