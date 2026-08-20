import { describe, expect, it } from 'vitest';
import { describeThisDesktop } from './describeThisDesktop';

describe('describeThisDesktop', () => {
  it('names the machine rather than the WebView nobody chose', () => {
    expect(
      describeThisDesktop('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15'),
    ).toBe('Flux on macOS');
  });

  it('recognises Windows', () => {
    expect(describeThisDesktop('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Flux on Windows',
    );
  });

  it('recognises Linux', () => {
    expect(describeThisDesktop('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Flux on Linux');
  });

  it('still says what it is where the machine is not recognised', () => {
    expect(describeThisDesktop('')).toBe('Flux for desktop');
  });
});
