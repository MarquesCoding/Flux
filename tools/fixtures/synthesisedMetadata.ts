type DolbyVisionConfig = {
  cm_version: string;
  profile: string;
  length: number;
  level6: {
    max_display_mastering_luminance: number;
    min_display_mastering_luminance: number;
    max_content_light_level: number;
    max_frame_average_light_level: number;
  };
};

type Hdr10PlusScene = {
  BezierCurveData: { Anchors: number[]; KneePointX: number; KneePointY: number };
  LuminanceParameters: {
    AverageRGB: number;
    LuminanceDistributions: { DistributionIndex: number[]; DistributionValues: number[] };
    MaxScl: number[];
  };
  NumberOfWindows: number;
  SceneFrameIndex: number;
  SceneId: number;
  SequenceFrameIndex: number;
  TargetedSystemDisplayMaximumLuminance: number;
};

type Hdr10PlusMetadata = {
  JSONInfo: { HDR10plusProfile: string; Version: string };
  SceneInfo: Hdr10PlusScene[];
  SceneInfoSummary: { SceneFirstFrameIndex: number[]; SceneFrameNumbers: number[] };
  ToolInfo: { Tool: string; Version: string };
};

const MASTERING_PEAK_NITS = 1000;

const CONTENT_LIGHT_NITS = 1000;

const FRAME_AVERAGE_NITS = 400;

/**
 * The Dolby Vision metadata a fixture carries, written rather than taken from anywhere.
 *
 * `dovi_tool` builds a real RPU from this, so the fixture is a genuine profile 8.1 stream without a
 * frame of anybody's film in it. 8.1 is the profile worth having: its base layer is ordinary HDR10,
 * which is what makes a player that cannot read the RPU show the picture rather than refuse it, and
 * therefore what a negotiator has to get right.
 *
 * @param frames - How many frames the metadata must cover.
 * @returns The generator configuration.
 */
const dolbyVisionConfig = (frames: number): DolbyVisionConfig => ({
  cm_version: 'V29',
  profile: '8.1',
  length: frames,
  level6: {
    max_display_mastering_luminance: MASTERING_PEAK_NITS,
    min_display_mastering_luminance: 1,
    max_content_light_level: CONTENT_LIGHT_NITS,
    max_frame_average_light_level: FRAME_AVERAGE_NITS,
  },
});

/**
 * The HDR10+ dynamic metadata a fixture carries, one scene across every frame.
 *
 * Also written rather than measured. The values describe a plausible tone curve and are not meant
 * to flatter the picture — what matters is that the SEI is present, well formed and read back as
 * SMPTE 2094-40, because that is the branch Valence could not reach before it had a file with it.
 *
 * The shape is not guessable and was taken from what `hdr10plus_tool` itself writes: `ToolInfo` at
 * the top level, and scenes that carry their index rather than their extent.
 *
 * @param frames - How many frames the metadata must cover.
 * @returns The metadata document.
 */
const hdr10PlusMetadata = (frames: number): Hdr10PlusMetadata => ({
  JSONInfo: { HDR10plusProfile: 'B', Version: '1.0' },
  SceneInfo: Array.from({ length: frames }, (_, index) => ({
    BezierCurveData: {
      Anchors: [100, 200, 300, 400, 500, 600, 700, 800, 900],
      KneePointX: 512,
      KneePointY: 400,
    },
    LuminanceParameters: {
      AverageRGB: 1024,
      LuminanceDistributions: {
        DistributionIndex: [1, 5, 10, 25, 50, 75, 90, 95, 99],
        DistributionValues: [0, 100, 200, 400, 800, 1600, 3200, 4000, 5000],
      },
      MaxScl: [17_000, 15_000, 12_000],
    },
    NumberOfWindows: 1,
    SceneFrameIndex: index,
    SceneId: 0,
    SequenceFrameIndex: index,
    TargetedSystemDisplayMaximumLuminance: FRAME_AVERAGE_NITS,
  })),
  SceneInfoSummary: { SceneFirstFrameIndex: [0], SceneFrameNumbers: [frames] },
  ToolInfo: { Tool: 'valence-fixtures', Version: '1.0' },
});

export type { DolbyVisionConfig, Hdr10PlusMetadata };

export { dolbyVisionConfig, hdr10PlusMetadata };
