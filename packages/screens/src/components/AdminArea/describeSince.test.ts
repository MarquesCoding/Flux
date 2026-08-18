import { describe, expect, it } from 'vitest';
import { describeSince } from './describeSince';

const NOW = Date.parse('2026-08-12T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('describeSince', () => {
  it('says never when it never has', () => {
    expect(describeSince(null, NOW)).toBe('never');
  });

  it('says never rather than NaN for something it cannot read', () => {
    expect(describeSince('not a date', NOW)).toBe('never');
  });

  it('says just now for the last minute', () => {
    expect(describeSince(ago(30_000), NOW)).toBe('just now');
  });

  it('counts minutes', () => {
    expect(describeSince(ago(5 * 60_000), NOW)).toBe('5 minutes ago');
  });

  it('does not say "1 minutes"', () => {
    expect(describeSince(ago(60_000), NOW)).toBe('1 minute ago');
  });

  it('counts hours', () => {
    expect(describeSince(ago(3 * 3_600_000), NOW)).toBe('3 hours ago');
  });

  it('does not say "1 hours"', () => {
    expect(describeSince(ago(3_600_000), NOW)).toBe('1 hour ago');
  });

  it('counts days', () => {
    expect(describeSince(ago(3 * 86_400_000), NOW)).toBe('3 days ago');
  });

  it('does not say "1 days"', () => {
    expect(describeSince(ago(86_400_000), NOW)).toBe('1 day ago');
  });

  it('rounds down rather than up, so nothing reads as older than it is', () => {
    expect(describeSince(ago(119 * 60_000), NOW)).toBe('1 hour ago');
  });
});
