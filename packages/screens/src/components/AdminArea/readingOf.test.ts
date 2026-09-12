import { describe, expect, it } from 'vitest';
import { readingOf } from '@ValenceScreens/components/AdminArea/readingOf';
import type { ScanEntry } from '@ValenceScreens/components/AdminArea/scanCoordinator';

const entry = (libraryId: string, kind: string): ScanEntry => ({
  libraryId,
  kind,
  phase: null,
  processed: null,
  total: null,
  jobId: 'job-1',
});

const progress = (...entries: ScanEntry[]) =>
  new Map(entries.map((found) => [`${found.libraryId}:${found.kind}`, found]));

describe('readingOf', () => {
  it('finds the scan a library has going', () => {
    const found = readingOf(progress(entry('films', 'scan')), 'films');

    expect(found?.kind).toBe('scan');
  });

  it('says nothing about a library that is only having its thumbnails drawn', () => {
    const drawing = progress(entry('films', 'library.regenerateTrickplay'));

    expect(readingOf(drawing, 'films')).toBeUndefined();
  });

  it('finds the reading among work of other kinds on the same library', () => {
    const both = progress(
      entry('films', 'library.regenerateTrickplay'),
      entry('films', 'library.regeneratePreviews'),
      entry('films', 'rescan'),
    );

    expect(readingOf(both, 'films')?.kind).toBe('rescan');
  });

  it('leaves another library alone', () => {
    expect(readingOf(progress(entry('shows', 'scan')), 'films')).toBeUndefined();
  });

  it('counts a re-read and a rebuild as reading, since neither may overlap a scan', () => {
    expect(readingOf(progress(entry('films', 'library.readAgain')), 'films')).toBeDefined();
    expect(readingOf(progress(entry('films', 'library.reset')), 'films')).toBeDefined();
  });

  it('says nothing when nothing is running at all', () => {
    expect(readingOf(new Map(), 'films')).toBeUndefined();
  });
});
