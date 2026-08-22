import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { withApiMemory } from './withApiMemory';

const ReadingSchema = z.object({ resources: z.object({ apiMemoryBytes: z.number() }) });

describe('withApiMemory', () => {
  it('says what this process is holding, which the media service cannot see', () => {
    const reading = ReadingSchema.parse(withApiMemory({ resources: { serviceMemoryBytes: 16 } }));

    expect(reading.resources.apiMemoryBytes).toBeGreaterThan(0);
  });

  it('leaves everything else in the reading alone', () => {
    expect(withApiMemory({ sessions: 2, resources: { cpuCount: 4 } })).toMatchObject({
      sessions: 2,
      resources: { cpuCount: 4 },
    });
  });

  it('hands back what it was given when the service said something else', () => {
    expect(withApiMemory({ reachable: false })).toEqual({ reachable: false });
    expect(withApiMemory(null)).toBeNull();
    expect(withApiMemory([1, 2])).toEqual([1, 2]);
    expect(withApiMemory({ resources: 'none' })).toEqual({ resources: 'none' });
  });
});
