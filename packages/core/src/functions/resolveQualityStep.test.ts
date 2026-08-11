import { describe, expect, it } from 'vitest';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import { resolveQualityStep } from './resolveQualityStep';

const media: MediaItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
};

describe('resolveQualityStep', () => {
  it('returns null for original', () => {
    expect(resolveQualityStep(media, 'original')).toBeNull();
  });

  it('clamps to the step bounding box and bitrate', () => {
    const clamp = resolveQualityStep(media, '720p');

    expect(clamp).toMatchObject({ maxWidth: 1280, maxHeight: 720, maxVideoBitrateKbps: 2500 });
  });

  it('leaves audio alone at 720p and above', () => {
    expect(resolveQualityStep(media, '1080p')?.maxAudioBitrateKbps).toBeNull();
    expect(resolveQualityStep(media, '720p')?.maxAudioBitrateKbps).toBeNull();
  });

  it('compresses audio below 720p', () => {
    expect(resolveQualityStep(media, '480p')?.maxAudioBitrateKbps).toBe(128);
    expect(resolveQualityStep(media, '144p')?.maxAudioBitrateKbps).toBe(128);
  });

  it('does not force a transcode when the source is already at or below the step', () => {
    const modest: MediaItem = { ...media, width: 1920, height: 1080, bitrateKbps: 3000 };

    expect(resolveQualityStep(modest, '1080p')).toBeNull();
  });

  it('still clamps when the source resolution fits but the bitrate does not', () => {
    const highBitrate: MediaItem = { ...media, width: 1920, height: 1080, bitrateKbps: 9000 };

    expect(resolveQualityStep(highBitrate, '1080p')).toMatchObject({ maxVideoBitrateKbps: 4500 });
  });

  it('still clamps when the bitrate fits but the resolution does not', () => {
    expect(resolveQualityStep(media, '1080p')).toMatchObject({ maxWidth: 1920, maxHeight: 1080 });
  });
});
