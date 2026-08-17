import { describe, expect, it } from 'vitest';
import { dolbyVisionConfig, hdr10PlusMetadata } from './synthesisedMetadata';

describe('dolbyVisionConfig', () => {
  it('asks for profile 8.1, whose base layer is ordinary HDR10', () => {
    expect(dolbyVisionConfig(240).profile).toBe('8.1');
  });

  it('covers exactly the frames it was asked for', () => {
    expect(dolbyVisionConfig(240).length).toBe(240);
    expect(dolbyVisionConfig(50).length).toBe(50);
  });

  it('declares mastering levels a player can act on', () => {
    const level6 = dolbyVisionConfig(240).level6;

    expect(level6.max_display_mastering_luminance).toBeGreaterThan(
      level6.min_display_mastering_luminance,
    );
    expect(level6.max_frame_average_light_level).toBeLessThanOrEqual(
      level6.max_content_light_level,
    );
  });
});

describe('hdr10PlusMetadata', () => {
  it('writes one scene entry per frame', () => {
    expect(hdr10PlusMetadata(240).SceneInfo).toHaveLength(240);
    expect(hdr10PlusMetadata(12).SceneInfo).toHaveLength(12);
  });

  it('numbers the frames in order from nought', () => {
    const scenes = hdr10PlusMetadata(5).SceneInfo;

    expect(scenes.map((scene) => scene.SceneFrameIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(scenes.map((scene) => scene.SequenceFrameIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('carries the shape hdr10plus_tool insists on', () => {
    const metadata = hdr10PlusMetadata(3);

    expect(Object.keys(metadata).sort()).toEqual([
      'JSONInfo',
      'SceneInfo',
      'SceneInfoSummary',
      'ToolInfo',
    ]);
    expect(metadata.JSONInfo.HDR10plusProfile).toBe('B');
    expect(metadata.SceneInfoSummary.SceneFrameNumbers).toEqual([3]);
  });

  it('describes a distribution that rises, as a real one does', () => {
    const distribution =
      hdr10PlusMetadata(1).SceneInfo[0]?.LuminanceParameters.LuminanceDistributions;

    const values = distribution?.DistributionValues ?? [];
    const rising = values.every((value, index) => index === 0 || value >= (values[index - 1] ?? 0));

    expect(rising).toBe(true);
    expect(distribution?.DistributionIndex).toHaveLength(values.length);
  });
});
