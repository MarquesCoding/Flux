import { describe, expect, it } from 'vitest';
import { defaultMediaJobs } from '@ValenceServer/env/defaultMediaJobs';

describe('defaultMediaJobs', () => {
  it('works on one file at a time, leaving the width to the media service', () => {
    expect(defaultMediaJobs()).toBe(1);
  });

  it('does not scale with the machine, which is what oversubscribed a graphics chip', () => {
    expect(defaultMediaJobs()).toBe(defaultMediaJobs());
  });
});
