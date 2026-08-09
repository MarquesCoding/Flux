import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppModule from './App'

const { App } = AppModule

const fetchMock = vi.fn()

const status = {
  isComplete: false,
  detectedOrigin: 'http://192.168.1.40:8420',
  isSecureContext: false,
  suggestedTrustedOrigins: ['http://192.168.1.40:8420'],
}

const respondWith = (body: object) => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('shows the setup wizard when the server reports setup is incomplete', async () => {
    respondWith(status)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Set up Flux' })).toBeInTheDocument()
  })

  it('shows the shell when the server reports setup is complete', async () => {
    respondWith({ ...status, isComplete: true })
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Flux' })).toBeInTheDocument()
  })

  it('renders a supplied title once setup is complete', async () => {
    respondWith({ ...status, isComplete: true })
    render(<App initialTitle="Living Room" />)

    expect(await screen.findByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
  })

  it('shows a spinner while the status is loading', () => {
    fetchMock.mockReturnValue(new Promise(() => undefined))
    render(<App />)

    expect(screen.getByRole('status', { name: 'Loading Flux' })).toBeInTheDocument()
  })

  it('reports an unreachable server rather than assuming setup is needed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Flux is not reachable' }),
    ).toBeInTheDocument()
  })

  it('does not show the wizard when the status request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    render(<App />)

    await screen.findByRole('heading', { name: 'Flux is not reachable' })

    expect(screen.queryByRole('heading', { name: 'Set up Flux' })).not.toBeInTheDocument()
  })

  it('asks the server again after setup completes', async () => {
    respondWith(status)
    render(<App />)

    await screen.findByRole('heading', { name: 'Set up Flux' })

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/status')
  })
})
