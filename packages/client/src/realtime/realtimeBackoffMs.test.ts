import { describe, expect, it } from 'vitest';
import { realtimeBackoffMs } from './realtimeBackoffMs';

describe('realtimeBackoffMs', () => {
  it('tries again quickly the first time, since most drops are momentary', () => {
    expect(realtimeBackoffMs(0)).toBe(500);
  });

  it('waits longer with each failure', () => {
    expect(realtimeBackoffMs(1)).toBeGreaterThan(realtimeBackoffMs(0));
    expect(realtimeBackoffMs(2)).toBeGreaterThan(realtimeBackoffMs(1));
  });

  it('stops growing, so a tab left overnight comes back promptly', () => {
    expect(realtimeBackoffMs(1000)).toBe(30000);
  });

  it('treats a nonsensical attempt count as the first one', () => {
    expect(realtimeBackoffMs(-5)).toBe(500);
  });
});
