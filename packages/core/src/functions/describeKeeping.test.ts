import { describe, expect, it } from 'vitest';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { describeKeeping, keptFraction } from './describeKeeping';

const aFile = (over: Partial<HeldFile> = {}): HeldFile => ({
  downloadId: '2b2b7f7e-2f0e-4a5e-9c2f-2b9b1e1f0a11',
  mediaId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 1_073_741_824,
  state: 'here',
  bytes: 1_073_741_824,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: true,
  ...over,
});

describe('keptFraction', () => {
  it('says how much of it is here', () => {
    expect(keptFraction(aFile({ bytes: 268_435_456 }))).toBe(0.25);
  });

  it('says nothing at all where nobody has been told how big it is', () => {
    expect(keptFraction(aFile({ ofBytes: null, bytes: 5 }))).toBeNull();
  });

  it('does not run past the end where the file turned out larger than promised', () => {
    expect(keptFraction(aFile({ ofBytes: 100, bytes: 140 }))).toBe(1);
  });
});

describe('describeKeeping', () => {
  it('says something is here, and how much of the disk it took', () => {
    expect(describeKeeping(aFile())).toBe('On this device — 1.0 GB.');
  });

  it('says how far a transfer has got and how fast it is going', () => {
    const said = describeKeeping(
      aFile({ state: 'fetching', bytes: 536_870_912, bytesPerSecond: 2_097_152 }),
    );

    expect(said).toContain('50%');
    expect(said).toContain('/s');
  });

  it('says what has arrived where nobody knows how much there is to come', () => {
    const said = describeKeeping(aFile({ state: 'fetching', ofBytes: null, bytes: 5_242_880 }));

    expect(said).toContain('5.0 MB so far');
    expect(said).not.toContain('%');
  });

  it('promises that a paused transfer has not been thrown away', () => {
    expect(describeKeeping(aFile({ state: 'paused', bytes: 536_870_912 }))).toBe(
      'Paused at 50%. What is here is kept.',
    );
  });

  it('says why it failed, in the words the thing that failed used', () => {
    expect(describeKeeping(aFile({ state: 'failed', failure: 'The disk is full.' }))).toBe(
      'The disk is full.',
    );
  });

  it('says something rather than nothing where a failure had no reason attached', () => {
    expect(describeKeeping(aFile({ state: 'failed', failure: null }))).toContain(
      'could not be fetched',
    );
  });
});
