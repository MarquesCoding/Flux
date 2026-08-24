import { describe, expect, it } from 'vitest';
import { describeQuality } from './describeQuality';

describe('describeQuality', () => {
  it('names a plain sixteen-by-nine release by its height', () => {
    expect(describeQuality(1920, 1080, 'SDR')).toBe('1080p');
    expect(describeQuality(1280, 720, 'SDR')).toBe('720p');
    expect(describeQuality(3840, 2160, 'SDR')).toBe('4K');
  });

  it('calls a letterboxed 1080p film 1080p, not 720p by its black bars', () => {
    expect(describeQuality(1920, 800, 'SDR')).toBe('1080p');
  });

  it('calls an ultrawide 4K film 4K rather than 1440p', () => {
    expect(describeQuality(3840, 1600, 'SDR')).toBe('4K');
  });

  it('calls a four-by-three 1080 broadcast 1080p, not 720p by its narrow frame', () => {
    expect(describeQuality(1440, 1080, 'SDR')).toBe('1080p');
  });

  it('calls standard definition 480p, whichever way round its frame is', () => {
    expect(describeQuality(640, 480, 'SDR')).toBe('480p');
    expect(describeQuality(854, 480, 'SDR')).toBe('480p');
  });

  it('carries the dynamic range where there is one worth naming', () => {
    expect(describeQuality(3840, 2160, 'HDR10')).toBe('4K HDR10');
  });

  it('says nothing about range for an ordinary file', () => {
    expect(describeQuality(1920, 1080, 'SDR')).toBe('1080p');
  });

  it('forgives a release a few rows short of the round number', () => {
    expect(describeQuality(1920, 1040, 'SDR')).toBe('1080p');
    expect(describeQuality(3840, 2076, 'SDR')).toBe('4K');
  });

  it('names the range alone where the size is not known', () => {
    expect(describeQuality(null, null, 'HDR10')).toBe('HDR10');
  });

  it('says nothing at all where nothing is known', () => {
    expect(describeQuality(null, null, null)).toBeNull();
    expect(describeQuality(null, null, '')).toBeNull();
  });

  it('says nothing for a picture smaller than anything worth naming', () => {
    expect(describeQuality(320, 240, 'SDR')).toBeNull();
  });
});
