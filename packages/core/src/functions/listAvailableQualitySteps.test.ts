import { describe, expect, it } from 'vitest';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import { listAvailableQualitySteps } from './listAvailableQualitySteps';

const media: MediaItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  width: 1920,
  height: 1080,
  bitrateKbps: 8000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
};

describe('listAvailableQualitySteps', () => {
  it('offers every step below the source height', () => {
    expect(listAvailableQualitySteps(media)).toEqual(['720p', '480p', '360p', '240p', '144p']);
  });

  it('never offers a step at or above the source height', () => {
    const sd: MediaItem = { ...media, width: 720, height: 480 };

    expect(listAvailableQualitySteps(sd)).toEqual(['360p', '240p', '144p']);
  });

  it('offers nothing below the smallest step', () => {
    const tiny: MediaItem = { ...media, width: 256, height: 144 };

    expect(listAvailableQualitySteps(tiny)).toEqual([]);
  });
});
