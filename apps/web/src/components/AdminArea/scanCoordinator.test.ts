import { beforeEach, describe, expect, it, vi } from 'vitest'
import scanCoordinatorModule from './scanCoordinator'
import type { Library } from '@FluxContracts/schemas/Library'

const scanLibraryMock = vi.hoisted(() => vi.fn())
const resetLibraryMock = vi.hoisted(() => vi.fn())
const regenerateLibraryPreviewsMock = vi.hoisted(() => vi.fn())
const readScanStateMock = vi.hoisted(() => vi.fn())
const runJobMock = vi.hoisted(() => vi.fn())

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  default: {
    scanLibrary: scanLibraryMock,
    resetLibrary: resetLibraryMock,
    regenerateLibraryPreviews: regenerateLibraryPreviewsMock,
    readScanState: readScanStateMock,
  },
}))

vi.mock('@FluxWeb/admin/fetchAdmin', () => ({
  default: {
    runJob: runJobMock,
  },
}))

const {
  startScan,
  startScanAll,
  startResetAll,
  startRegeneratePreviews,
  runDefinedJob,
  runDefinedJobAll,
  subscribe,
  getSnapshot,
  resetForTests,
} = scanCoordinatorModule

beforeEach(() => {
  resetForTests()
  scanLibraryMock.mockReset()
  resetLibraryMock.mockReset()
  regenerateLibraryPreviewsMock.mockReset()
  readScanStateMock.mockReset()
  runJobMock.mockReset()
})

const LIBRARY: Library = {
  id: 'library-1',
  name: 'Movies',
  kind: 'movies',
  path: '/media/movies',
  itemCount: 10,
  lastScannedAt: null,
  defaultAudioLanguage: null,
}

describe('scanCoordinator', () => {
  it('tracks a scan until it completes', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-1', state: 'queued' })
    readScanStateMock
      .mockResolvedValueOnce({ state: 'running', phase: 'probing', processed: 1, total: 4 })
      .mockResolvedValueOnce({ state: 'completed', phase: 'probing', processed: 4, total: 4 })

    const seen: boolean[] = []
    const stop = subscribe(() => {
      seen.push(getSnapshot().progress.has('library-1'))
    })

    await startScan('library-1')
    stop()

    expect(seen).toContain(true)
    expect(getSnapshot().progress.has('library-1')).toBe(false)
  })

  it('survives no listener being subscribed, the same as an unmounted admin page', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-2', state: 'queued' })
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    })

    await expect(startScan('library-solo')).resolves.toBeUndefined()
  })

  it('reports scan-all as busy for its whole run', async () => {
    scanLibraryMock.mockResolvedValue({ jobId: 'job-3', state: 'queued' })
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    })

    const promise = startScanAll([LIBRARY])

    expect(getSnapshot().isScanningAll).toBe(true)

    await promise

    expect(getSnapshot().isScanningAll).toBe(false)
  })

  it('reports reset-all as busy for its whole run', async () => {
    resetLibraryMock.mockResolvedValue({ jobId: 'job-4', state: 'queued' })
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    })

    const promise = startResetAll([LIBRARY])

    expect(getSnapshot().isResettingAll).toBe(true)

    await promise

    expect(getSnapshot().isResettingAll).toBe(false)
  })

  it('tracks preview regeneration under its own kind', async () => {
    regenerateLibraryPreviewsMock.mockResolvedValue({ jobId: 'job-5', state: 'queued' })
    readScanStateMock.mockResolvedValueOnce({
      state: 'running',
      phase: 'previews',
      processed: 1,
      total: 2,
    })
    readScanStateMock.mockResolvedValueOnce({
      state: 'completed',
      phase: 'previews',
      processed: 2,
      total: 2,
    })

    let sawRegenerateKind = false
    const stop = subscribe(() => {
      const entry = getSnapshot().progress.get('library-regen')

      if (entry?.kind === 'regeneratePreviews') {
        sawRegenerateKind = true
      }
    })

    await startRegeneratePreviews('library-regen')
    stop()

    expect(sawRegenerateKind).toBe(true)
  })

  it('stops tracking once the job comes back null', async () => {
    scanLibraryMock.mockResolvedValue(null)

    await startScan('library-null')

    expect(getSnapshot().progress.has('library-null')).toBe(false)
  })

  it('tracks a job started by kind, from the Work tab picker', async () => {
    runJobMock.mockResolvedValue({ jobId: 'job-6', state: 'queued' })
    readScanStateMock
      .mockResolvedValueOnce({ state: 'running', phase: 'probing', processed: 1, total: 2 })
      .mockResolvedValueOnce({ state: 'completed', phase: 'probing', processed: 2, total: 2 })

    let sawKind: string | null = null
    const stop = subscribe(() => {
      const entry = getSnapshot().progress.get('library-defined')

      if (entry !== undefined) {
        sawKind = entry.kind
      }
    })

    await runDefinedJob('library.reset', 'library-defined', true)
    stop()

    expect(runJobMock).toHaveBeenCalledWith('library.reset', 'library-defined', true)
    expect(sawKind).toBe('library.reset')
    expect(getSnapshot().progress.has('library-defined')).toBe(false)
  })

  it('runs a job by kind against every library at once', async () => {
    runJobMock.mockResolvedValue({ jobId: 'job-7', state: 'queued' })
    readScanStateMock.mockResolvedValue({
      state: 'completed',
      phase: null,
      processed: null,
      total: null,
    })

    await runDefinedJobAll('library.scan', [LIBRARY])

    expect(runJobMock).toHaveBeenCalledWith('library.scan', LIBRARY.id, undefined)
  })
})
