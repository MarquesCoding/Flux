import { describe, expect, it } from 'vitest';
import { describeScanResult } from './describeScanResult';

const aScan = (overrides: Partial<Parameters<typeof describeScanResult>[0]> = {}) => ({
  added: 0,
  updated: 0,
  removed: 0,
  failed: 0,
  ...overrides,
});

describe('describeScanResult', () => {
  it('says nothing changed rather than showing three zeros', () => {
    expect(describeScanResult(aScan())).toBe('Nothing changed');
  });

  it('counts what a scan found', () => {
    expect(describeScanResult(aScan({ added: 4, updated: 1 }))).toBe('+4 ~1 −0');
  });

  it('states removals even when there are none, since that is the number to watch', () => {
    expect(describeScanResult(aScan({ added: 4 }))).toContain('−0');
  });

  it('makes a scan that emptied a library impossible to miss', () => {
    expect(describeScanResult(aScan({ removed: 214 }))).toBe('+0 ~0 −214');
  });

  it('names unreadable files only when there are some', () => {
    expect(describeScanResult(aScan({ added: 1, failed: 2 }))).toContain('2 unreadable');
    expect(describeScanResult(aScan({ added: 1 }))).not.toContain('unreadable');
  });
});
