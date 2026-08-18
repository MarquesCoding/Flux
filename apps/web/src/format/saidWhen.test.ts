import { describe, expect, it } from 'vitest';
import { saidWhen } from './saidWhen';

describe('saidWhen', () => {
  it('says a moment as a date and a time rather than as a timestamp', () => {
    expect(saidWhen('2026-03-04T15:30:00.000Z')).toMatch(/2026/);
  });

  it('says something vague where the moment cannot be read', () => {
    expect(saidWhen('not a date')).toBe('at some point');
  });
});
