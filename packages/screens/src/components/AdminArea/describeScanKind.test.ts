import { describe, expect, it } from 'vitest';
import { describeScanKind } from './describeScanKind';

describe('describeScanKind', () => {
  it('names a scan this page started', () => {
    expect(describeScanKind('scan', 'Films')).toBe('Scanning Films');
  });

  it('names a scan picked up from the server after a reload', () => {
    expect(describeScanKind('library.scan', 'Films')).toBe('Scanning Films');
  });

  it('tells a forced read apart from an ordinary scan', () => {
    expect(describeScanKind('rescan', 'Films')).toBe('Reading every file in Films');
  });

  it('names the re-read a correction sets off', () => {
    expect(describeScanKind('library.readAgain', 'Shows')).toBe(
      'Reading the corrected files in Shows',
    );
  });

  it('says work is happening rather than guessing at a kind it does not know', () => {
    expect(describeScanKind('plugin.somethingNew', 'Shows')).toBe('Working on Shows');
  });
});
