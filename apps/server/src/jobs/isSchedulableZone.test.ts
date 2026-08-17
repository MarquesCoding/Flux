import { describe, expect, it } from 'vitest';
import { isSchedulableZone } from './isSchedulableZone';

describe('isSchedulableZone', () => {
  it('accepts a named zone', () => {
    expect(isSchedulableZone('Europe/London')).toBe(true);
  });

  it('accepts a named zone that has no daylight saving', () => {
    expect(isSchedulableZone('America/Phoenix')).toBe(true);
  });

  it('accepts UTC, which is a name rather than an offset', () => {
    expect(isSchedulableZone('UTC')).toBe(true);
  });

  it('refuses a fixed offset, which cannot follow daylight saving', () => {
    expect(isSchedulableZone('+01:00')).toBe(false);
    expect(isSchedulableZone('-0500')).toBe(false);
  });

  it('refuses a zone that does not exist', () => {
    expect(isSchedulableZone('Not/AZone')).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(isSchedulableZone(undefined)).toBe(false);
    expect(isSchedulableZone('')).toBe(false);
  });
});
