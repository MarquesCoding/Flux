import { describe, expect, it, vi } from 'vitest';
import { jobBehindTheKey } from './jobBehindTheKey';

const SCAN = 'library.scan';

const FILMS = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('jobBehindTheKey', () => {
  it('reports the job this call started', async () => {
    const jobs = { liveJob: vi.fn(() => Promise.resolve(null)) };

    await expect(jobBehindTheKey('job-mine', SCAN, FILMS, jobs)).resolves.toEqual({
      jobId: 'job-mine',
      state: 'queued',
    });
    expect(jobs.liveJob).not.toHaveBeenCalled();
  });

  it('finds the job that already held the key, rather than inventing an id', async () => {
    const jobs = { liveJob: vi.fn(() => Promise.resolve('job-theirs')) };

    await expect(jobBehindTheKey(null, SCAN, FILMS, jobs)).resolves.toEqual({
      jobId: 'job-theirs',
      state: 'running',
    });
    expect(jobs.liveJob).toHaveBeenCalledWith(SCAN, FILMS);
  });

  it('answers with nothing rather than an id nobody can follow', async () => {
    await expect(
      jobBehindTheKey(null, SCAN, FILMS, { liveJob: vi.fn(() => Promise.resolve(null)) }),
    ).resolves.toBeNull();
  });
});
