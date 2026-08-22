import { describe, expect, it } from 'vitest';
import { qualityStepCostsFor } from './qualityStepCostsFor';
import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';
import type { MediaItem } from '@ValenceContracts/schemas/MediaItem';

const profile: DeviceProfile = {
  schemaVersion: 1,
  name: 'Laptop',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40_000,
  maxAudioChannels: 8,
  supportedVideoRanges: ['SDR', 'HDR10'],
  tenBitVideoCodecs: [],
  maxVideoLevels: {},
  canPlayInterlaced: true,
  canPlayAnamorphic: true,
  canRotate: true,
  unsupportedAudioProfiles: [],
  supportedSubtitleFormats: ['srt', 'webvtt'],
  directPlayProfiles: [
    { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['truehd', 'aac'] },
  ],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

const remux: MediaItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  container: 'mkv',
  durationSeconds: 8520,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 3840,
  height: 2160,
  bitrateKbps: 80_657,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
};

describe('qualityStepCostsFor', () => {
  it('describes every rung on offer, in both units', () => {
    const costs = qualityStepCostsFor({ media: remux, profile });

    expect(costs['720p']).toBe('up to 2.5 Mbps · ~2.7 GB');
    expect(costs['1080p']).toBe('up to 4.5 Mbps · ~4.8 GB');
  });

  it('reports what the source is worth, not the rung ceiling, once the source is modest', () => {
    const compressed: MediaItem = { ...remux, bitrateKbps: 4_500 };
    const costs = qualityStepCostsFor({ media: compressed, profile });

    expect(costs['720p']).not.toContain('2.5 Mbps');
    expect(costs['720p']).toContain('1.4 Mbps');
  });

  it('describes no rung it does not offer', () => {
    const modest: MediaItem = { ...remux, width: 1920, height: 1080, bitrateKbps: 3_000 };

    expect(costs1080pOf(modest)).toBeUndefined();
  });

  it('answers with nothing rather than throwing when the profile cannot be read', () => {
    const hostile: DeviceProfile = {
      ...profile,
      get directPlayProfiles(): DeviceProfile['directPlayProfiles'] {
        throw new Error('the profile arrived half formed');
      },
    };

    expect(qualityStepCostsFor({ media: remux, profile: hostile })).toEqual({});
    expect(() => qualityStepCostsFor({ media: remux, profile: hostile })).not.toThrow();
  });
});

const costs1080pOf = (media: MediaItem): string | undefined =>
  qualityStepCostsFor({ media, profile })['1080p'];

describe('qualityStepCostsFor, the original', () => {
  it('describes the original, so the rungs have something to be read against', () => {
    const costs = qualityStepCostsFor({ media: remux, profile });

    expect(costs.original).toBeDefined();
  });

  it('caps the original at what the device will take, rather than quoting the file', () => {
    const costs = qualityStepCostsFor({ media: remux, profile });

    expect(costs.original).toBe('up to 40.0 Mbps · ~42.6 GB');
  });

  it('states the original plainly where the file itself is what gets sent', () => {
    const withinReach: MediaItem = { ...remux, bitrateKbps: 8_900 };
    const costs = qualityStepCostsFor({ media: withinReach, profile });

    expect(costs.original?.startsWith('up to')).toBe(false);
    expect(costs['720p']?.startsWith('up to')).toBe(true);
  });

  it('leaves the original out rather than guessing when nothing can be read', () => {
    const hostile: DeviceProfile = {
      ...profile,
      get directPlayProfiles(): DeviceProfile['directPlayProfiles'] {
        throw new Error('the profile arrived half formed');
      },
    };

    expect(qualityStepCostsFor({ media: remux, profile: hostile }).original).toBeUndefined();
  });
});

describe('qualityStepCostsFor, an original the device cannot decode', () => {
  const noHevc: DeviceProfile = {
    ...profile,
    directPlayProfiles: [
      { container: 'mkv', videoCodecs: ['h264'], audioCodecs: ['truehd', 'aac'] },
    ],
  };

  const hevcSource: MediaItem = { ...remux, videoCodec: 'hevc', bitrateKbps: 8_900 };

  it('quotes what a re-encode will actually cost, not what the file happens to be', () => {
    const costs = qualityStepCostsFor({ media: hevcSource, profile: noHevc });

    expect(costs.original).not.toContain('8.9 Mbps');
    expect(costs.original).toContain('14.8 Mbps');
  });

  it('calls it a ceiling, because a re-encode is capped rather than fixed', () => {
    const costs = qualityStepCostsFor({ media: hevcSource, profile: noHevc });

    expect(costs.original?.startsWith('up to')).toBe(true);
  });

  it('still states the file own figure plainly where the file is what gets sent', () => {
    const costs = qualityStepCostsFor({ media: hevcSource, profile });

    expect(costs.original).toBe('8.9 Mbps · ~9.5 GB');
  });
});
