import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAreaModule from './AdminArea'
import type { Monitor } from '@FluxWeb/admin/fetchAdmin'

const { AdminArea } = AdminAreaModule

const OVERVIEW = {
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

const fetchMock = vi.fn()

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
  fetchMock.mockImplementation((input: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(input.includes('monitor') ? MONITOR : OVERVIEW),
    }),
  )

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
    fetchMock.mockImplementation((input: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            input.includes('monitor')
              ? MONITOR
              : {
                  ...OVERVIEW,
                  transcoder: { isReachable: false, ffmpegVersion: null, hardwareAccels: [] },
                },
          ),
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
})
