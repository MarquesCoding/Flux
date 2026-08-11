import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAreaModule from './AdminArea'
import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin'
import type { Library } from '@FluxContracts/schemas/Library'

const { AdminArea } = AdminAreaModule

const OVERVIEW: AdminOverview = {
  users: [
    {
      id: 'abc',
      name: 'Marques',
      email: 'marques@flux.local',
      role: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  settings: {
    hasCatalogueKey: false,
    trustedOrigins: ['http://localhost:5173'],
    cookieSecure: false,
  },
  transcoder: { isReachable: true, ffmpegVersion: '9.0.1', hardwareAccels: ['videotoolbox'] },
  library: { itemCount: 15, libraryCount: 2 },
}

const MONITOR: Monitor = {
  resources: {
    atMs: 1,
    systemCpuPercent: 42,
    systemMemoryUsedBytes: 8 * 1024 ** 3,
    systemMemoryTotalBytes: 16 * 1024 ** 3,
    cpuCount: 10,
    serviceCpuPercent: 3,
    serviceMemoryBytes: 200 * 1024 ** 2,
    children: [{ pid: 4242, cpuPercent: 190, memoryBytes: 300 * 1024 ** 2 }],
    loadAverage: 1.5,
  },
  queue: {
    concurrency: 2,
    queued: 1,
    running: 1,
    jobs: [
      {
        id: 1,
        kind: 'preview',
        subject: 'Parasite (2019).mkv',
        state: 'running',
        queuedAtMs: 0,
        startedAtMs: 0,
        finishedAtMs: null,
        detail: null,
      },
      {
        id: 2,
        kind: 'thumbnails',
        subject: 'Interstellar (2014).mkv',
        state: 'failed',
        queuedAtMs: 0,
        startedAtMs: 0,
        finishedAtMs: 900,
        detail: 'no such encoder',
      },
    ],
  },
  sessions: 1,
  logs: [{ atMs: 0, level: 'error', source: 'transcoder', message: 'Could not open the file' }],
}

const MOVIES_LIBRARY_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const LIBRARIES: Library[] = [
  {
    id: MOVIES_LIBRARY_ID,
    name: 'Movies',
    kind: 'movies',
    path: '/media/movies',
    itemCount: 42,
    lastScannedAt: null,
  },
]

const CREATED_LIBRARY: Library = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Shows',
  kind: 'shows',
  path: '/media/shows',
  itemCount: 0,
  lastScannedAt: null,
}

const SHOWS_LIBRARY_ID = '22222222-2222-4222-8222-222222222222'

const TWO_LIBRARIES: Library[] = [
  ...LIBRARIES,
  {
    id: SHOWS_LIBRARY_ID,
    name: 'Shows',
    kind: 'shows',
    path: '/media/shows',
    itemCount: 5,
    lastScannedAt: null,
  },
]

const fetchMock = vi.fn()

/**
 * Answers whatever the admin page's requests ask for.
 *
 * One implementation shared by every test rather than one per test, so a
 * test that overrides the overview does not have to relearn how libraries,
 * scans and the monitor stream are answered too.
 */
const respondWith =
  (overview: typeof OVERVIEW = OVERVIEW) =>
  (input: string, init?: RequestInit) => {
    if (input.includes('/scans/')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ jobId: 'scan-job', state: 'completed', processed: 1, total: 1 }),
      })
    }

    if (input.includes('/scan')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobId: 'scan-job', state: 'queued' }),
      })
    }

    if (input.includes('/api/libraries') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(CREATED_LIBRARY) })
    }

    if (input.includes('/api/libraries')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(LIBRARIES) })
    }

    if (input.includes('monitor')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MONITOR) })
    }

    return Promise.resolve({ ok: true, json: () => Promise.resolve(overview) })
  }

class FakeEventSource {
  static last: FakeEventSource | null = null

  onmessage: ((event: MessageEvent<string>) => void) | null = null

  isClosed = false

  constructor(readonly url: string) {
    FakeEventSource.last = this
  }

  close() {
    this.isClosed = true
  }
}

beforeEach(() => {
  FakeEventSource.last = null
  fetchMock.mockReset()
  fetchMock.mockImplementation(respondWith())

  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminArea', () => {
  it('says whether the media service is up', async () => {
    render(<AdminArea />)

    expect(await screen.findByText(/Media service up/)).toBeInTheDocument()
  })

  it('says when the media service is not up, which is the thing worth knowing', async () => {
    fetchMock.mockImplementation(
      respondWith({
        ...OVERVIEW,
        transcoder: { isReachable: false, ffmpegVersion: null, hardwareAccels: [] },
      }),
    )

    render(<AdminArea />)

    expect(await screen.findByText('Media service unreachable')).toBeInTheDocument()
  })

  it('keeps the figures worth half an eye on', async () => {
    render(<AdminArea />)

    expect(await screen.findByText('42%')).toBeInTheDocument()
  })

  it('watches rather than asking every second whether anything happened', () => {
    render(<AdminArea />)

    expect(FakeEventSource.last?.url).toBe('/api/admin/monitor/stream')
  })

  it('follows the machine as it changes', async () => {
    render(<AdminArea />)

    await waitFor(() => {
      expect(screen.getByText('42%')).toBeInTheDocument()
    })

    FakeEventSource.last?.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          ...MONITOR,
          resources: { ...MONITOR.resources, systemCpuPercent: 91 },
        }),
      }),
    )

    expect(await screen.findByText('91%')).toBeInTheDocument()
  })

  it('stops watching once the page is left', () => {
    const { unmount } = render(<AdminArea />)

    unmount()

    expect(FakeEventSource.last?.isClosed).toBe(true)
  })

  it('shows what the media service is working on', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Work' }))

    expect(screen.getByText('Parasite (2019).mkv')).toBeInTheDocument()
  })

  it('says why a job failed rather than only that it did', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Work' }))

    expect(screen.getByText('no such encoder')).toBeInTheDocument()
  })

  it('shows what the server has been saying', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Events' }))

    expect(screen.getByText('Could not open the file')).toBeInTheDocument()
  })

  it('lets an operator set the catalogue key', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Settings' }))
    await actor.type(screen.getByLabelText('Catalogue key'), 'a-key')
    await actor.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/settings', expect.anything())
    })
  })

  it('lists who has an account', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Settings' }))

    expect(screen.getByText('marques@flux.local')).toBeInTheDocument()
  })

  it('draws something rather than nothing before the server has answered', () => {
    render(<AdminArea />)

    expect(screen.getByText('Server')).toBeInTheDocument()
  })

  it('lists the library roots', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))

    expect(screen.getByText('Movies')).toBeInTheDocument()
    expect(screen.getByText(/\/media\/movies/)).toBeInTheDocument()
  })

  it('adds a library from the dialog', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Add library' }))

    const dialog = screen.getByRole('dialog', { name: 'Add a library' })

    await actor.type(within(dialog).getByLabelText('Name'), 'Shows')
    await actor.type(within(dialog).getByLabelText('Path'), '/media/shows')
    await actor.click(within(dialog).getByRole('button', { name: 'Add library' }))

    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument()
    })

    expect(screen.getByText('Shows')).toBeInTheDocument()
  })

  it('scans a library on request', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Scan' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/libraries/${MOVIES_LIBRARY_ID}/scan`, {
        method: 'POST',
      })
    })
  })

  it('offers to scan every library at once, forcing a fresh probe of each', async () => {
    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/libraries/${MOVIES_LIBRARY_ID}/scan?force=true`,
        { method: 'POST' },
      )
    })
  })

  it('shows a progress bar in place of the button while a library is scanning', async () => {
    const scanUrl = `/api/libraries/${MOVIES_LIBRARY_ID}/scan`

    fetchMock.mockImplementation((input: string, init?: RequestInit) =>
      input === scanUrl ? new Promise(() => undefined) : respondWith()(input, init),
    )

    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Scan' }))

    expect(await screen.findByRole('progressbar', { name: 'Scanning Movies' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan' })).not.toBeInTheDocument()
  })

  it('reports how many files have actually been probed as the scan goes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const actor = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    const scanUrl = `/api/libraries/${MOVIES_LIBRARY_ID}/scan`
    let readings = 0

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === scanUrl) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobId: 'scan-job', state: 'queued' }),
        })
      }

      if (input.includes('/scans/')) {
        readings += 1

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              readings === 1
                ? { jobId: 'scan-job', state: 'running', processed: 3, total: 10 }
                : { jobId: 'scan-job', state: 'completed', processed: 10, total: 10 },
            ),
        })
      }

      return respondWith()(input, init)
    })

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Scan' }))

    expect(await screen.findByText('3/10')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(1000)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('replaces every scan button with its own progress bar when scanning all libraries', async () => {
    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === '/api/libraries' && init?.method !== 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(TWO_LIBRARIES) })
      }

      if (input.includes('/scan?force=true')) {
        return new Promise(() => undefined)
      }

      return respondWith()(input, init)
    })

    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))
    await actor.click(screen.getByRole('button', { name: 'Scan all libraries' }))

    expect(await screen.findByRole('progressbar', { name: 'Scanning Movies' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Scanning Shows' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Scan' })).toHaveLength(0)
  })

  it('guides the operator when there are no libraries', async () => {
    fetchMock.mockImplementation((input: string, init?: RequestInit) =>
      input.includes('/api/libraries') && init?.method !== 'POST'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        : respondWith()(input, init),
    )

    const actor = userEvent.setup()

    render(<AdminArea />)

    await actor.click(await screen.findByRole('button', { name: 'Libraries' }))

    expect(await screen.findByText(/No libraries yet/)).toBeInTheDocument()
  })
})
