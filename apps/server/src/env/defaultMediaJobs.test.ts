import { describe, expect, it } from 'vitest';
import { defaultMediaJobs } from '@ValenceServer/env/defaultMediaJobs';

describe('defaultMediaJobs', () => {
  it('gives a job every two cores', () => {
    expect(defaultMediaJobs(8)).toBe(4);
    expect(defaultMediaJobs(20)).toBe(10);
  });

  it('scales past the four it used to stop at, which a large server was held to', () => {
    expect(defaultMediaJobs(20)).toBeGreaterThan(4);
  });

  it('still works on one file at a time on a machine with a single core', () => {
    expect(defaultMediaJobs(1)).toBe(1);
    expect(defaultMediaJobs(0)).toBe(1);
  });

  it('stops widening, because readers past some width slow each other down', () => {
    expect(defaultMediaJobs(128)).toBe(16);
  });
});
