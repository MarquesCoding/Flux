import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import waitForScanCompletionModule from './waitForScanCompletion'

const readScanStateMock = vi.hoisted(() => vi.fn())

vi.mock('./fetchLibrary', () => ({
  default: { readScanState: readScanStateMock },
}))

const { waitForScanCompletion } = waitForScanCompletionModule

beforeEach(() => {
  readScanStateMock.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('waitForScanCompletion', () => {
  it('returns immediately when the scan is already done', async () => {
    readScanStateMock.mockResolvedValue('completed')

    await waitForScanCompletion('job-1')

    expect(readScanStateMock).toHaveBeenCalledTimes(1)
  })

  it('keeps checking in until the scan reaches a terminal state', async () => {
    readScanStateMock
      .mockResolvedValueOnce('queued')
      .mockResolvedValueOnce('running')
      .mockResolvedValueOnce('completed')

    const settled = waitForScanCompletion('job-1')

    await vi.runAllTimersAsync()
    await settled

    expect(readScanStateMock).toHaveBeenCalledTimes(3)
  })

  it('stops on failure rather than waiting forever', async () => {
    readScanStateMock.mockResolvedValueOnce('running').mockResolvedValueOnce('failed')

    const settled = waitForScanCompletion('job-1')

    await vi.runAllTimersAsync()
    await settled

    expect(readScanStateMock).toHaveBeenCalledTimes(2)
  })
})
