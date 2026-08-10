import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LibraryBrowserModule from './LibraryBrowser'
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'

const { LibraryBrowser } = LibraryBrowserModule

const fetchLibrariesMock = vi.hoisted(() => vi.fn())
const fetchItemsMock = vi.hoisted(() => vi.fn())
const scanMock = vi.hoisted(() => vi.fn())

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  default: {
    fetchLibraries: fetchLibrariesMock,
    fetchLibraryItems: fetchItemsMock,
    scanLibrary: scanMock,
  },
}))

const films: Library = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  name: 'Films',
  kind: 'movies',
  path: '/media/films',
  itemCount: 2,
  lastScannedAt: null,
}

const shows: Library = { ...films, id: '11111111-1111-4111-8111-111111111111', name: 'Shows' }

const arrival: MediaSummary = {
  id: '9c858901-8a57-4791-81fe-4c455b099bc9',
  libraryId: films.id,
  title: 'Arrival',
  year: 2016,
  durationSeconds: 6960,
  width: 3840,
  height: 2160,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
}

beforeEach(() => {
  fetchLibrariesMock.mockReset()
  fetchItemsMock.mockReset()
  scanMock.mockReset()

  fetchLibrariesMock.mockResolvedValue([films])
  fetchItemsMock.mockResolvedValue({ items: [arrival], total: 1 })
  scanMock.mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LibraryBrowser', () => {
  it('shows a spinner while loading', () => {
    fetchLibrariesMock.mockReturnValue(new Promise(() => undefined))
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'Loading your library' })).toBeInTheDocument()
  })

  it('lists the items in the first library', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Arrival/ })).toBeInTheDocument()
  })

  it('shows resolution and range badges', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })

    expect(screen.getByText('4K')).toBeInTheDocument()
    expect(screen.getByText('HDR10')).toBeInTheDocument()
  })

  it('reports how many items there are', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(await screen.findByText('1 item')).toBeInTheDocument()
  })

  it('plays the item that was chosen', async () => {
    const onPlay = vi.fn()
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={onPlay} />)

    await actor.click(await screen.findByRole('button', { name: /Arrival/ }))

    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: arrival.id }))
  })

  it('asks the server to search rather than filtering the page it holds', async () => {
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })
    await actor.type(screen.getByLabelText('Search'), 'dune')

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(
        films.id,
        expect.objectContaining({
          search: 'dune',
        }),
      )
    })
  })

  it('does not send a request for every keystroke', async () => {
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })
    fetchItemsMock.mockClear()
    await actor.type(screen.getByLabelText('Search'), 'dune')

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalled()
    })

    expect(fetchItemsMock.mock.calls.length).toBeLessThan(4)
  })

  it('says when a search matches nothing', async () => {
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 })
    await actor.type(screen.getByLabelText('Search'), 'zzz')

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument()
  })

  it('switches between libraries', async () => {
    fetchLibrariesMock.mockResolvedValue([films, shows])
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await actor.click(await screen.findByRole('button', { name: 'Shows' }))

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(shows.id, expect.anything())
    })
  })

  it('asks the server for a page rather than the whole library', async () => {
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await waitFor(() => {
      expect(fetchItemsMock).toHaveBeenCalledWith(films.id, expect.objectContaining({ limit: 60 }))
    })
  })

  it('rescans on request and reloads', async () => {
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })
    await actor.click(screen.getByRole('button', { name: 'Scan' }))

    await waitFor(() => {
      expect(scanMock).toHaveBeenCalledWith(films.id, false)
    })
  })

  it('offers a full rescan that probes every file again', async () => {
    const actor = userEvent.setup()
    render(<LibraryBrowser onPlay={vi.fn()} />)

    await screen.findByRole('button', { name: /Arrival/ })
    await actor.click(screen.getByRole('button', { name: 'Full rescan' }))

    await waitFor(() => {
      expect(scanMock).toHaveBeenCalledWith(films.id, true)
    })
  })

  it('guides the operator when there are no libraries', async () => {
    fetchLibrariesMock.mockResolvedValue([])
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'No libraries yet' })).toBeInTheDocument()
  })

  it('says when an empty library needs scanning', async () => {
    fetchItemsMock.mockResolvedValue({ items: [], total: 0 })
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(await screen.findByText(/Scan it to find your media/)).toBeInTheDocument()
  })

  it('reports an unreachable server', async () => {
    fetchLibrariesMock.mockRejectedValue(new Error('offline'))
    render(<LibraryBrowser onPlay={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
  })
})
