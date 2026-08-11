import { describe, expect, it } from 'vitest';
import { cleanupSessions } from './cleanupSessions';
describe('cleanupSessions', () => {
  it('reports how many rows it removed in total', async () => {
    const total = await cleanupSessions({
      deleteExpiredSessions: () => Promise.resolve(3),
      deleteExpiredDeviceCodes: () => Promise.resolve(2),
    });

    expect(total).toBe(5);
  });

  it('reports progress for each table it clears', async () => {
    const progress: [string, number, number][] = [];

    await cleanupSessions({
      deleteExpiredSessions: () => Promise.resolve(1),
      deleteExpiredDeviceCodes: () => Promise.resolve(0),
      onProgress: (phase, processed, total) => progress.push([phase, processed, total]),
    });

    expect(progress).toEqual([
      ['sessions', 0, 1],
      ['sessions', 1, 1],
      ['deviceCodes', 0, 1],
      ['deviceCodes', 1, 1],
    ]);
  });

  it('removes nothing when nothing has expired', async () => {
    const total = await cleanupSessions({
      deleteExpiredSessions: () => Promise.resolve(0),
      deleteExpiredDeviceCodes: () => Promise.resolve(0),
    });

    expect(total).toBe(0);
  });
});
