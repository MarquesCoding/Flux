import { describe, expect, it } from 'vitest';
import { readDigestWindow } from './readDigestWindow';

const now = new Date('2026-08-15T20:00:00.000Z');

describe('readDigestWindow', () => {
  it('says nothing on the first run, whatever the library already holds', () => {
    expect(readDigestWindow(null, now).announce).toBe(false);
  });

  it('starts reading from now on the first run rather than from the beginning', () => {
    expect(readDigestWindow(null, now).since).toStrictEqual(now);
  });

  it('reads from where the last digest finished', () => {
    const window = readDigestWindow('2026-08-15T19:45:00.000Z', now);

    expect(window.since).toStrictEqual(new Date('2026-08-15T19:45:00.000Z'));
    expect(window.announce).toBe(true);
  });
});
