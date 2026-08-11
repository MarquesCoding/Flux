import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import waitForScanCompletionModule from './waitForScanCompletion'

const readScanStateMock = vi.hoisted(() => vi.fn())

vi.mock('./fetchLibrary', () => ({
  default: { readScanState: readScanStateMock },
}))

const { waitForScanCompletion } = waitForScanCompletionModule

const progress = (state: string, processed: number | null = null, total: number | null = null) => ({
  jobId: 'job-1',
  state,
  processed,
  total,
})

beforeEach(() => {
  readScanStateMock.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('waitForScanCompletion', () => {
  it('returns immediately when the scan is already done', async () => {
    readScanStateMock.mockResolvedValue(progress('completed'))

    await waitForScanCompletion('job-1')

    expect(readScanStateMock).toHaveBeenCalledTimes(1)
  })

  it('keeps checking in until the scan reaches a terminal state', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('queued'))
      .mockResolvedValueOnce(progress('running', 4, 10))
      .mockResolvedValueOnce(progress('completed', 10, 10))

    const settled = waitForScanCompletion('job-1')

    await vi.runAllTimersAsync()
    await settled

    expect(readScanStateMock).toHaveBeenCalledTimes(3)
  })

  it('stops on failure rather than waiting forever', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('running', 1, 10))
      .mockResolvedValueOnce(progress('failed', 2, 10))

    const settled = waitForScanCompletion('job-1')

    await vi.runAllTimersAsync()
    await settled

    expect(readScanStateMock).toHaveBeenCalledTimes(2)
  })

  it('hands every reading to onProgress as it arrives', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('running', 0, 10))
      .mockResolvedValueOnce(progress('running', 5, 10))
      .mockResolvedValueOnce(progress('completed', 10, 10))

    const onProgress = vi.fn()
    const settled = waitForScanCompletion('job-1', onProgress)

    await vi.runAllTimersAsync()
    await settled

    expect(onProgress).toHaveBeenNthCalledWith(1, progress('running', 0, 10))
    expect(onProgress).toHaveBeenNthCalledWith(2, progress('running', 5, 10))
    expect(onProgress).toHaveBeenNthCalledWith(3, progress('completed', 10, 10))
  })
})
