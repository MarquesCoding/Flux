import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeThisBrowser } from './describeThisBrowser';

const claimingToBe = (userAgent: string): void => {
  vi.stubGlobal('navigator', { userAgent });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('describeThisBrowser', () => {
  it('names the browser and the machine it is running on', () => {
    claimingToBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36');

    expect(describeThisBrowser()).toBe('Chromium on macOS');
  });

  it('reads whatever this browser says about itself, rather than a fixed answer', () => {
    claimingToBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0');

    expect(describeThisBrowser()).toBe('Firefox on Windows');
  });

  it('still answers where the browser says nothing useful', () => {
    claimingToBe('');

    expect(describeThisBrowser()).toBe('Browser');
  });
});
