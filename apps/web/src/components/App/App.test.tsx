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

const aLibraryWithArrival = {
  libraries: [
    {
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      name: 'Films',
      kind: 'movies',
      path: '/media',
      itemCount: 1,
      lastScannedAt: null,
    },
  ],
  items: {
    total: 1,
    items: [
      {
        id: '9c858901-8a57-4791-81fe-4c455b099bc9',
        libraryId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        title: 'Arrival',
        year: 2016,
        durationSeconds: 7200,
        width: 1920,
        height: 1080,
        videoCodec: 'hevc',
        videoRange: 'HDR10',
        addedAt: '2026-08-10T00:00:00.000Z',
        hasPoster: false,
        hasBackdrop: false,
      },
    ],
  },
} satisfies { libraries: JsonValue; items: JsonValue }

/**
 * Routes the two endpoints the shell depends on, so tests describe server
 * state rather than call ordering.
 */
const serverState = (options: {
  setup: JsonValue
  session: JsonValue
  libraries?: JsonValue
  items?: JsonValue
}) => {
  fetchMock.mockImplementation((input) => {
    if (input === '/api/setup/status') {
      return Promise.resolve(ok(options.setup))
    }

    if (input.startsWith('/api/libraries/') && input.includes('/items')) {
      return Promise.resolve(ok(options.items ?? { items: [], total: 0 }))
    }

    if (input.startsWith('/api/libraries')) {
      return Promise.resolve(ok(options.libraries ?? []))
    }

    if (input.startsWith('/api/media/')) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
    }

    return Promise.resolve(ok(options.session))
  })
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

    // The shell names itself in the sidebar rather than as a page heading: a
    // heading that vanishes when the rail is collapsed would leave the page
    // without one.
    expect(await screen.findByText('Flux')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    expect(screen.getByText('admin@flux.test')).toBeInTheDocument()
  })

  it('renders a supplied title when signed in', async () => {
    serverState({ setup: setupComplete, session: { user } })
    render(<App initialTitle="Living Room" />)

    expect(await screen.findByText('Living Room')).toBeInTheDocument()
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

    await screen.findByText('admin@flux.test')

    serverState({ setup: setupComplete, session: null })
    await actor.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to Flux' })).toBeInTheDocument()
  })

  it('opens an item for a look rather than playing it straight away', async () => {
    const actor = userEvent.setup()
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival })
    render(<App />)

    await actor.click(await screen.findByRole('button', { name: /Arrival/ }))

    expect(await screen.findByRole('dialog', { name: 'Arrival' })).toBeInTheDocument()
    // The dialog carries the same name, so the player is identified by the
    // one control only it has.
    expect(screen.queryByRole('slider', { name: /Seek through/ })).not.toBeInTheDocument()
  })

  it('fills the page with the player once someone presses play', async () => {
    const actor = userEvent.setup()
    serverState({ setup: setupComplete, session: { user }, ...aLibraryWithArrival })
    render(<App />)

    await actor.click(await screen.findByRole('button', { name: /Arrival/ }))
    await actor.click(await screen.findByRole('button', { name: 'Play' }))

    expect(await screen.findByRole('slider', { name: 'Seek through Arrival' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Search' })).not.toBeInTheDocument()
  })
})
