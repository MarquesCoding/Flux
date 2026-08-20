import { describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { frameUrl, FRAME_WIDTH } from './frameUrl';

describe('frameUrl', () => {
  it('asks the playback service for a frame of an item', () => {
    expect(frameUrl('abc', 30)).toBe(
      `/api/playback/abc/frame?seconds=30&width=${FRAME_WIDTH.toString()}`,
    );
  });

  it('puts the moment in the address, so each frame is cached on its own', () => {
    expect(frameUrl('abc', 30)).not.toBe(frameUrl('abc', 60));
  });

  it('asks for whole seconds, since a fraction of one is not an address', () => {
    expect(frameUrl('abc', 30.7)).toContain('seconds=30');
  });

  it('never asks for a moment before the beginning', () => {
    expect(frameUrl('abc', -5)).toContain('seconds=0');
  });

  it('can be asked for a width other than the usual one', () => {
    expect(frameUrl('abc', 0, 320)).toContain('width=320');
  });
});

describe('a client that serves its own pages', () => {
  it('asks the server for a frame rather than asking itself', () => {
    forgetPlatform();
    installPlatform({ ...aFakePlatform(), whereTheServerIs: () => 'https://flux.example.com' });

    expect(frameUrl('a-media-id', 30)).toBe(
      'https://flux.example.com/api/playback/a-media-id/frame?seconds=30&width=1280',
    );

    forgetPlatform();
  });
});
