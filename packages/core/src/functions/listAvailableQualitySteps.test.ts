import { describe, expect, it } from 'vitest';
import type { MediaItem } from '@ValenceContracts/schemas/MediaItem';
import { QUALITY_STEPS } from '@ValenceContracts/schemas/QualityStep';
import { resolveQualityStep } from './resolveQualityStep';
import { listAvailableQualitySteps } from './listAvailableQualitySteps';

const media: MediaItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 1920,
  height: 1080,
  bitrateKbps: 8000,
  audioStreams: [{ index: 1, codec: 'aac', channels: 2, isDefault: true, isAtmos: false }],
  subtitleStreams: [],
};

describe('listAvailableQualitySteps', () => {
  it('offers the source own height where that would still cut the bitrate', () => {
    expect(listAvailableQualitySteps(media)).toEqual([
      '1080p',
      '720p',
      '480p',
      '360p',
      '240p',
      '144p',
    ]);
  });

  it('offers a remux its own resolution, which is the whole point of a rung for a poor line', () => {
    const remux: MediaItem = { ...media, videoCodec: 'h264', bitrateKbps: 30_000 };

    expect(listAvailableQualitySteps(remux)).toContain('1080p');
  });

  it('withholds the source own height once there is nothing left to save', () => {
    const modest: MediaItem = { ...media, bitrateKbps: 3_000 };

    expect(listAvailableQualitySteps(modest)).not.toContain('1080p');
    expect(listAvailableQualitySteps(modest)).toEqual(['720p', '480p', '360p', '240p', '144p']);
  });

  it('never offers a step taller than the source, which would deliver nothing', () => {
    const sd: MediaItem = { ...media, width: 720, height: 480, bitrateKbps: 3_000 };

    expect(listAvailableQualitySteps(sd)).not.toContain('1080p');
    expect(listAvailableQualitySteps(sd)).not.toContain('720p');
  });

  it('offers nothing at all where the file is already inside the smallest rung', () => {
    const tiny: MediaItem = { ...media, width: 256, height: 144, bitrateKbps: 100 };

    expect(listAvailableQualitySteps(tiny)).toEqual([]);
  });

  it('offers a rung only where the server would act on it, and every one where it would', () => {
    const items = [media, { ...media, bitrateKbps: 30_000 }, { ...media, bitrateKbps: 3_000 }];

    for (const item of items) {
      const offered = listAvailableQualitySteps(item);

      for (const step of QUALITY_STEPS) {
        const wouldAct =
          step.maxHeight <= item.height && resolveQualityStep(item, step.id) !== null;

        expect(offered.includes(step.id)).toBe(wouldAct);
      }
    }
  });
});

describe('listAvailableQualitySteps, films shot in scope', () => {
  const scope: MediaItem = { ...media, width: 1920, height: 800, bitrateKbps: 12_000 };

  it('keeps the rung matching a scope film own resolution', () => {
    expect(listAvailableQualitySteps(scope)).toContain('1080p');
  });

  it('does not let it reach for a rung it has neither the width nor the height for', () => {
    expect(listAvailableQualitySteps(scope)).not.toContain('1440p');
  });

  it('offers a 4K scope film both the rungs beneath it', () => {
    const wide: MediaItem = { ...media, width: 3840, height: 1600, bitrateKbps: 40_000 };

    expect(listAvailableQualitySteps(wide)).toContain('1440p');
    expect(listAvailableQualitySteps(wide)).toContain('1080p');
  });

  it('offers a tall picture the rung its height reaches', () => {
    const tall: MediaItem = { ...media, width: 800, height: 1080, bitrateKbps: 12_000 };

    expect(listAvailableQualitySteps(tall)).toContain('1080p');
    expect(listAvailableQualitySteps(tall)).not.toContain('1440p');
  });
});

describe('listAvailableQualitySteps, 4K', () => {
  const uhd: MediaItem = { ...media, width: 3840, height: 2160, bitrateKbps: 60_994 };

  it('offers a 4K source its own resolution at a lower bitrate', () => {
    expect(listAvailableQualitySteps(uhd)).toContain('2160p');
  });

  it('does not offer 4K to a source that has not got it', () => {
    const hd: MediaItem = { ...media, width: 1920, height: 1080, bitrateKbps: 30_000 };

    expect(listAvailableQualitySteps(hd)).not.toContain('2160p');
  });

  it('withholds 4K from a 4K source already inside the rung', () => {
    const lean: MediaItem = { ...uhd, bitrateKbps: 12_000 };

    expect(listAvailableQualitySteps(lean)).not.toContain('2160p');
  });

  it('offers 4K to a scope film that has the width but not the height', () => {
    const scope: MediaItem = { ...media, width: 3840, height: 1600, bitrateKbps: 60_994 };

    expect(listAvailableQualitySteps(scope)).toContain('2160p');
  });
});
