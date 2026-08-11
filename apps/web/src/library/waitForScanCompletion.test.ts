import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitForScanCompletion } from './waitForScanCompletion';

const readScanStateMock = vi.hoisted(() => vi.fn());

vi.mock('./fetchLibrary', () => ({
  readScanState: readScanStateMock,
}));

const progress = (
  state: string,
  phase: string | null = null,
  processed: number | null = null,
  total: number | null = null,
) => ({
  jobId: 'job-1',
  state,
  phase,
  processed,
  total,
});

beforeEach(() => {
  readScanStateMock.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('waitForScanCompletion', () => {
  it('returns immediately when the scan is already done', async () => {
    readScanStateMock.mockResolvedValue(progress('completed'));

    await waitForScanCompletion('job-1');

    expect(readScanStateMock).toHaveBeenCalledTimes(1);
  });

  it('keeps checking in until the scan reaches a terminal state', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('queued'))
      .mockResolvedValueOnce(progress('running', 'probing', 4, 10))
      .mockResolvedValueOnce(progress('completed', 'previews', 10, 10));

    const settled = waitForScanCompletion('job-1');

    await vi.runAllTimersAsync();
    await settled;

    expect(readScanStateMock).toHaveBeenCalledTimes(3);
  });

  it('stops on failure rather than waiting forever', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('running', 'probing', 1, 10))
      .mockResolvedValueOnce(progress('failed', 'probing', 2, 10));

    const settled = waitForScanCompletion('job-1');

    await vi.runAllTimersAsync();
    await settled;

    expect(readScanStateMock).toHaveBeenCalledTimes(2);
  });

  it('hands every reading to onProgress as it arrives', async () => {
    readScanStateMock
      .mockResolvedValueOnce(progress('running', 'probing', 0, 10))
      .mockResolvedValueOnce(progress('running', 'probing', 5, 10))
      .mockResolvedValueOnce(progress('completed', 'previews', 8, 8));

    const onProgress = vi.fn();
    const settled = waitForScanCompletion('job-1', onProgress);

    await vi.runAllTimersAsync();
    await settled;

    expect(onProgress).toHaveBeenNthCalledWith(1, progress('running', 'probing', 0, 10));
    expect(onProgress).toHaveBeenNthCalledWith(2, progress('running', 'probing', 5, 10));
    expect(onProgress).toHaveBeenNthCalledWith(3, progress('completed', 'previews', 8, 8));
  });
});
