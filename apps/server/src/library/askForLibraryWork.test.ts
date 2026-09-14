import { describe, expect, it, vi } from 'vitest';
import { askForLibraryWork } from './askForLibraryWork';

const SHEETS = 'library.regenerateTrickplay';

const FILMS = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const queue = (live: string | null, started: string | null = 'job-new') => ({
  liveJob: vi.fn(() => Promise.resolve(live)),
  enqueue: vi.fn(() => Promise.resolve(started)),
});

describe('askForLibraryWork', () => {
  it('starts the work when nothing is doing it', async () => {
    const jobs = queue(null);

    await expect(askForLibraryWork(jobs, SHEETS, FILMS, { libraryId: FILMS })).resolves.toEqual({
      jobId: 'job-new',
      state: 'queued',
    });
    expect(jobs.enqueue).toHaveBeenCalledWith(SHEETS, { libraryId: FILMS }, FILMS);
  });

  it('hands back the job already doing it rather than starting a second', async () => {
    const jobs = queue('job-drawing');

    await expect(askForLibraryWork(jobs, SHEETS, FILMS, { libraryId: FILMS })).resolves.toEqual({
      jobId: 'job-drawing',
      state: 'running',
    });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('does not confuse one library being drawn with another', async () => {
    const shows = '9f8e7d6c-5b4a-4938-8271-615041302928';
    const jobs = {
      liveJob: vi.fn((_kind: string, subject?: string) =>
        Promise.resolve(subject === FILMS ? 'job-drawing' : null),
      ),
      enqueue: vi.fn(() => Promise.resolve('job-new')),
    };

    await expect(askForLibraryWork(jobs, SHEETS, shows, { libraryId: shows })).resolves.toEqual({
      jobId: 'job-new',
      state: 'queued',
    });
  });

  it('does not confuse one kind of work with another on the same library', async () => {
    const jobs = {
      liveJob: vi.fn((kind: string) => Promise.resolve(kind === SHEETS ? 'job-drawing' : null)),
      enqueue: vi.fn(() => Promise.resolve('job-new')),
    };

    await expect(
      askForLibraryWork(jobs, 'library.regeneratePreviews', FILMS, { libraryId: FILMS }),
    ).resolves.toEqual({ jobId: 'job-new', state: 'queued' });
  });

  it('falls back to the job holding the key where one was taken between looking and asking', async () => {
    const jobs = {
      liveJob: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('job-someone-else'),
      enqueue: vi.fn(() => Promise.resolve(null)),
    };

    await expect(askForLibraryWork(jobs, SHEETS, FILMS, { libraryId: FILMS })).resolves.toEqual({
      jobId: 'job-someone-else',
      state: 'running',
    });
  });

  it('says nothing is doing it where the queue lost the job entirely', async () => {
    const jobs = {
      liveJob: vi.fn(() => Promise.resolve(null)),
      enqueue: vi.fn(() => Promise.resolve(null)),
    };

    await expect(askForLibraryWork(jobs, SHEETS, FILMS, { libraryId: FILMS })).resolves.toBeNull();
  });
});
