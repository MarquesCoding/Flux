import { describe, expect, it } from 'vitest';
import type { MediaItem } from '@FluxContracts/schemas/MediaItem';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import { negotiatePlayback } from './negotiatePlayback';

const media: MediaItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  videoBitDepth: 8,
  canCopySegments: true,
  videoIsInterlaced: false,
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [
    { index: 1, codec: 'truehd', channels: 8, language: 'eng', isDefault: true, isAtmos: true },
  ],
  subtitleStreams: [],
};

const profile: DeviceProfile = {
  schemaVersion: 1,
  name: 'Living room TV',
  maxWidth: 3840,
  maxHeight: 2160,
  maxBitrateKbps: 40000,
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

const unlimited: DeviceProfile = { ...profile, maxBitrateKbps: undefined };

describe('negotiatePlayback', () => {
  it('passes every axis through when the client supports the source', () => {
    const plan = negotiatePlayback(media, profile);

    expect(plan.container.kind).toBe('passthrough');
    expect(plan.video.kind).toBe('passthrough');
    expect(plan.audio.kind).toBe('passthrough');
    expect(plan.subtitles.kind).toBe('none');
  });

  it('remuxes when only the container is unsupported', () => {
    const plan = negotiatePlayback({ ...media, container: 'avi' }, profile);

    expect(plan.container).toMatchObject({ kind: 'remux', target: 'ts' });
    expect(plan.video.kind).toBe('passthrough');
    expect(plan.audio.kind).toBe('passthrough');
  });

  it('transcodes video when the codec is unsupported', () => {
    const plan = negotiatePlayback({ ...media, videoCodec: 'av1' }, profile);

    expect(plan.video).toMatchObject({ kind: 'transcode', codec: 'h264' });
    expect(plan.video.reason.code).toBe('VideoCodecNotSupported');
  });

  it('does not touch audio when the video range is unsupported', () => {
    const sdrOnly: DeviceProfile = { ...profile, supportedVideoRanges: ['SDR'] };

    const plan = negotiatePlayback(media, sdrOnly);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoRangeNotSupported');
    expect(plan.audio.kind).toBe('passthrough');
  });

  it('copies a Dolby Vision source whose base layer is a range the client reads', () => {
    const profile81 = {
      ...media,
      videoRange: 'DolbyVision' as const,
      videoRangeBase: 'HDR10' as const,
    };

    const plan = negotiatePlayback(profile81, profile);

    expect(plan.video.kind).toBe('passthrough');
  });

  it('copies an HDR10+ source to an HDR10 client, which reads the layer underneath it', () => {
    const plus = { ...media, videoRange: 'HDR10Plus' as const, videoRangeBase: 'HDR10' as const };

    const plan = negotiatePlayback(plus, profile);

    expect(plan.video.kind).toBe('passthrough');
  });

  it('re-encodes a Dolby Vision source with no base layer anything else can read', () => {
    const profile5 = {
      ...media,
      videoRange: 'DolbyVision' as const,
      videoRangeBase: 'DolbyVision' as const,
    };

    const plan = negotiatePlayback(profile5, profile);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoRangeNotSupported');
  });

  it('re-encodes a source read as a range this client still cannot show', () => {
    const hlgBase = {
      ...media,
      videoRange: 'DolbyVision' as const,
      videoRangeBase: 'HLG' as const,
    };

    const plan = negotiatePlayback(hlgBase, profile);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoRangeNotSupported');
  });

  it('re-encodes a Dolby Vision source that predates knowing what is underneath it', () => {
    const unprobed = { ...media, videoRange: 'DolbyVision' as const };

    const plan = negotiatePlayback(unprobed, profile);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoRangeNotSupported');
  });

  it('encodes to the base layer rather than flattening it, where something else forces a transcode', () => {
    const profile81 = {
      ...media,
      videoRange: 'DolbyVision' as const,
      videoRangeBase: 'HDR10' as const,
      videoCodec: 'av1',
    };

    const plan = negotiatePlayback(profile81, profile);

    expect(plan.video).toMatchObject({ kind: 'transcode', range: 'HDR10' });
  });

  it('will not copy a source whose keyframes cannot be cut into playable segments', () => {
    const openGop = { ...media, canCopySegments: false };

    const plan = negotiatePlayback(openGop, profile);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoNotSegmentable');
  });

  it('will not copy ten bit video to a client that only claimed eight', () => {
    const tenBit = { ...media, videoBitDepth: 10 };

    const plan = negotiatePlayback(tenBit, profile);

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('VideoProfileNotSupported');
  });

  it('copies ten bit video to a client that says it can decode it', () => {
    const tenBit = { ...media, videoBitDepth: 10, videoRange: 'SDR' as const };
    const capable: DeviceProfile = { ...profile, tenBitVideoCodecs: ['hevc'] };

    const plan = negotiatePlayback(tenBit, capable);

    expect(plan.video.kind).toBe('passthrough');
  });

  it('copies eight bit video to a client that claimed nothing about ten', () => {
    const eightBit = { ...media, videoRange: 'SDR' as const };

    const plan = negotiatePlayback(eightBit, { ...profile, supportedVideoRanges: ['SDR'] });

    expect(plan.video.kind).toBe('passthrough');
  });

  it('sends a heavy source as it is where nothing stated a ceiling to hold it to', () => {
    const heavy = { ...media, bitrateKbps: 25756 };

    const plan = negotiatePlayback(heavy, unlimited);

    expect(plan.video.kind).toBe('passthrough');
  });

  it('still holds a heavy source to a rung the viewer pinned, ceiling or no ceiling', () => {
    const heavy = { ...media, bitrateKbps: 25756 };

    const plan = negotiatePlayback(heavy, unlimited, {
      maxWidth: 3840,
      maxHeight: 2160,
      maxVideoBitrateKbps: 8000,
      maxAudioBitrateKbps: 128,
    });

    expect(plan.video.kind).toBe('transcode');
    expect(plan.video.reason.code).toBe('UserForcedTranscode');
  });

  it('encodes to what the source is worth where nothing capped it', () => {
    const modest = { ...media, bitrateKbps: 8900, videoCodec: 'av1' as const };

    const plan = negotiatePlayback(modest, { ...unlimited, supportedVideoRanges: ['SDR'] });

    expect(plan.video).toMatchObject({ kind: 'transcode', codec: 'h264' });
    expect(plan.video.kind === 'transcode' && plan.video.maxBitrateKbps).toBeGreaterThan(8900);
  });

  it('preserves a supported HDR range through a bitrate transcode', () => {
    const lowBitrate: DeviceProfile = { ...profile, maxBitrateKbps: 8000 };

    const plan = negotiatePlayback(media, lowBitrate);

    expect(plan.video).toMatchObject({ kind: 'transcode', range: 'HDR10' });
    expect(plan.video.reason.code).toBe('VideoBitrateAboveLimit');
  });

  it('encodes near what the source spends rather than at what the client would allow', () => {
    const modest = { ...media, bitrateKbps: 8900, videoCodec: 'hevc' as const };
    const roomy: DeviceProfile = { ...profile, maxBitrateKbps: 20000, tenBitVideoCodecs: [] };

    const plan = negotiatePlayback(modest, { ...roomy, supportedVideoRanges: ['SDR'] });

    expect(plan.video).toMatchObject({ kind: 'transcode', codec: 'h264', maxBitrateKbps: 14833 });
  });

  it('never asks for more than the client said it can carry', () => {
    const heavy = { ...media, bitrateKbps: 18000, videoCodec: 'hevc' as const };
    const capped: DeviceProfile = { ...profile, maxBitrateKbps: 20000 };

    const plan = negotiatePlayback(heavy, { ...capped, supportedVideoRanges: ['SDR'] });

    expect(plan.video).toMatchObject({ kind: 'transcode', maxBitrateKbps: 20000 });
  });

  describe('the facts a client refuses a direct play over', () => {
    const sdr = { ...media, videoRange: 'SDR' as const };
    const capable: DeviceProfile = { ...profile, supportedVideoRanges: ['SDR'] };

    it('transcodes a level the client does not decode', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoLevel: 153 },
        { ...capable, maxVideoLevels: { hevc: 120 } },
      );

      expect(plan.video.reason.code).toBe('VideoLevelNotSupported');
    });

    it('copies a level the client does decode', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoLevel: 120 },
        { ...capable, maxVideoLevels: { hevc: 120 } },
      );

      expect(plan.video.kind).toBe('passthrough');
    });

    it('reads the level ceiling for the source codec rather than any codec', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoLevel: 153 },
        { ...capable, maxVideoLevels: { h264: 51 } },
      );

      expect(plan.video.kind).toBe('passthrough');
    });

    it('transcodes a frame rate above what the client accepts', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoFrameRate: 60 },
        { ...capable, maxFrameRate: 30 },
      );

      expect(plan.video.reason.code).toBe('VideoFramerateNotSupported');
    });

    it('transcodes interlaced video for a client that cannot deinterlace', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoIsInterlaced: true },
        { ...capable, canPlayInterlaced: false },
      );

      expect(plan.video.reason.code).toBe('InterlacedVideoNotSupported');
    });

    it('transcodes more reference frames than the decoder can hold', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoRefFrames: 9 },
        { ...capable, maxRefFrames: 4 },
      );

      expect(plan.video.reason.code).toBe('RefFramesNotSupported');
    });

    it('transcodes non-square pixels for a client that shows every picture square', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoPixelAspect: '4/3' },
        { ...capable, canPlayAnamorphic: false },
      );

      expect(plan.video.reason.code).toBe('AnamorphicVideoNotSupported');
    });

    it('leaves square pixels alone even where the client cannot rotate', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoPixelAspect: '1/1' },
        { ...capable, canPlayAnamorphic: false },
      );

      expect(plan.video.kind).toBe('passthrough');
    });

    it('transcodes rotated video for a client that cannot turn it back', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoRotationDegrees: 90 },
        { ...capable, canRotate: false },
      );

      expect(plan.video.reason.code).toBe('VideoRotationNotSupported');
    });

    it('treats a rotation of a full turn as no rotation', () => {
      const plan = negotiatePlayback(
        { ...sdr, videoRotationDegrees: 360 },
        { ...capable, canRotate: false },
      );

      expect(plan.video.kind).toBe('passthrough');
    });

    it('passes through every fact the client stated no limit on', () => {
      const plan = negotiatePlayback(
        {
          ...sdr,
          videoLevel: 186,
          videoFrameRate: 120,
          videoRefFrames: 16,
          videoPixelAspect: '4/3',
          videoRotationDegrees: 90,
        },
        capable,
      );

      expect(plan.video.kind).toBe('passthrough');
    });

    it('transcodes a sample rate above what the client accepts', () => {
      const highRate = {
        ...sdr,
        audioStreams: [{ ...media.audioStreams[0]!, sampleRate: 96000 }],
      };

      const plan = negotiatePlayback(highRate, { ...capable, maxAudioSampleRate: 48000 });

      expect(plan.audio.reason.code).toBe('AudioSampleRateNotSupported');
    });

    it('transcodes an audio profile the client cannot decode', () => {
      const highEfficiency = {
        ...sdr,
        audioStreams: [{ ...media.audioStreams[0]!, profile: 'HE-AAC' }],
      };

      const plan = negotiatePlayback(highEfficiency, {
        ...capable,
        unsupportedAudioProfiles: ['HE-AAC'],
      });

      expect(plan.audio.reason.code).toBe('AudioProfileNotSupported');
    });
  });

  it('tone maps to SDR only when the client cannot render the source range', () => {
    const sdrOnly: DeviceProfile = { ...profile, supportedVideoRanges: ['SDR'] };

    const plan = negotiatePlayback(media, sdrOnly);

    expect(plan.video).toMatchObject({ kind: 'transcode', range: 'SDR' });
  });

  it('does not touch video when only the audio codec is unsupported', () => {
    const noTrueHd: DeviceProfile = {
      ...profile,
      directPlayProfiles: [
        { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['aac'] },
      ],
    };

    const plan = negotiatePlayback(media, noTrueHd);

    expect(plan.video.kind).toBe('passthrough');
    expect(plan.audio).toMatchObject({ kind: 'transcode', codec: 'aac' });
  });

  it('leaves the channels alone where the client can decode the track itself', () => {
    const stereoOnly: DeviceProfile = { ...profile, maxAudioChannels: 2 };

    const plan = negotiatePlayback(media, stereoOnly);

    expect(plan.audio.kind).toBe('passthrough');
  });

  it('passes a surround track through to a client with the channels for it', () => {
    const surround = {
      ...media,
      audioStreams: [
        { index: 1, codec: 'aac', channels: 6, language: 'eng', isDefault: true, isAtmos: false },
      ],
    };

    const plan = negotiatePlayback(surround, { ...profile, maxAudioChannels: 6 });

    expect(plan.audio).toMatchObject({ kind: 'passthrough' });
  });

  it('passes that same track to a client whose output only takes two, which folds it down itself', () => {
    const surround = {
      ...media,
      audioStreams: [
        { index: 1, codec: 'aac', channels: 6, language: 'eng', isDefault: true, isAtmos: false },
      ],
    };

    const plan = negotiatePlayback(surround, { ...profile, maxAudioChannels: 2 });

    expect(plan.audio.kind).toBe('passthrough');
  });

  it('still encodes to the channels a client has, once something else has forced an encode', () => {
    const surround = {
      ...media,
      audioStreams: [
        {
          index: 1,
          codec: 'truehd',
          channels: 6,
          language: 'eng',
          isDefault: true,
          isAtmos: false,
        },
      ],
    };

    const noTrueHd: DeviceProfile = {
      ...profile,
      maxAudioChannels: 2,
      directPlayProfiles: [
        { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['aac'] },
      ],
    };

    const plan = negotiatePlayback(surround, noTrueHd);

    expect(plan.audio).toMatchObject({ kind: 'transcode', codec: 'aac', channels: 2 });
  });

  it('passes a picture larger than the screen through, rather than re-encoding it to fit', () => {
    const hd: DeviceProfile = { ...profile, maxWidth: 1920, maxHeight: 1080 };

    const plan = negotiatePlayback(media, hd);

    expect(plan.video.kind).toBe('passthrough');
  });

  it('still refuses a picture the decoder itself cannot take, which is the real limit', () => {
    const modest: DeviceProfile = { ...profile, maxVideoLevels: { hevc: 120 } };

    const plan = negotiatePlayback({ ...media, videoLevel: 153 }, modest);

    expect(plan.video.reason.code).toBe('VideoLevelNotSupported');
  });

  it('passes supported text subtitles through', () => {
    const withSubs: MediaItem = {
      ...media,
      subtitleStreams: [{ index: 2, format: 'srt', language: 'eng', isForced: false }],
    };

    const plan = negotiatePlayback(withSubs, profile);

    expect(plan.subtitles).toMatchObject({ kind: 'passthrough', streamIndex: 2 });
  });

  it('converts unsupported text subtitles to a sidecar rather than burning in', () => {
    const withSubs: MediaItem = {
      ...media,
      subtitleStreams: [{ index: 2, format: 'ass', language: 'eng', isForced: false }],
    };

    const plan = negotiatePlayback(withSubs, profile);

    expect(plan.subtitles).toMatchObject({ kind: 'sidecar', format: 'webvtt' });
  });

  it('burns in image based subtitles that cannot be converted', () => {
    const withSubs: MediaItem = {
      ...media,
      subtitleStreams: [{ index: 2, format: 'pgs', language: 'eng', isForced: false }],
    };

    const plan = negotiatePlayback(withSubs, profile);

    expect(plan.subtitles).toMatchObject({ kind: 'burnIn', streamIndex: 2 });
  });

  it('always populates a reason on every axis', () => {
    const plan = negotiatePlayback(media, profile);

    expect(plan.container.reason.detail).not.toBe('');
    expect(plan.video.reason.detail).not.toBe('');
    expect(plan.audio.reason.detail).not.toBe('');
    expect(plan.subtitles.reason.detail).not.toBe('');
  });

  describe('preferred audio language', () => {
    const multilingual: MediaItem = {
      ...media,
      audioStreams: [
        { index: 1, codec: 'truehd', channels: 8, language: 'deu', isDefault: true, isAtmos: true },
        { index: 2, codec: 'aac', channels: 2, language: 'eng', isDefault: false, isAtmos: false },
      ],
    };

    it('picks the stream matching the preferred language over the default', () => {
      const plan = negotiatePlayback(multilingual, profile, null, 'en');

      expect(plan.audio).toMatchObject({ streamIndex: 2 });
    });

    it('accepts language written in any of the forms a file might use', () => {
      const plan = negotiatePlayback(multilingual, profile, null, 'english');

      expect(plan.audio).toMatchObject({ streamIndex: 2 });
    });

    it('falls back to the default stream when no stream matches', () => {
      const plan = negotiatePlayback(multilingual, profile, null, 'fr');

      expect(plan.audio).toMatchObject({ streamIndex: 1 });
    });

    it('falls back to the default stream when no language is preferred', () => {
      const plan = negotiatePlayback(multilingual, profile);

      expect(plan.audio).toMatchObject({ streamIndex: 1 });
    });

    it('records the streamIndex actually chosen even with no preference at all', () => {
      const plan = negotiatePlayback(media, profile);

      expect(plan.audio).toMatchObject({ streamIndex: 1 });
    });
  });

  describe('quality clamp', () => {
    it('leaves the plan untouched when there is no clamp', () => {
      const plan = negotiatePlayback(media, profile, null);

      expect(plan.video.kind).toBe('passthrough');
    });

    it('forces a resolution transcode below what the device alone would require', () => {
      const plan = negotiatePlayback(media, profile, {
        maxWidth: 1280,
        maxHeight: 720,
        maxVideoBitrateKbps: 2500,
        maxAudioBitrateKbps: null,
      });

      expect(plan.video).toMatchObject({
        kind: 'transcode',
        maxWidth: 1280,
        maxHeight: 720,
        maxBitrateKbps: 2500,
      });
      expect(plan.video.reason.code).toBe('UserForcedTranscode');
    });

    it('attributes the transcode to the device, not the clamp, when the device is the tighter limit', () => {
      const weak: DeviceProfile = {
        ...profile,
        maxWidth: 640,
        maxHeight: 360,
        maxBitrateKbps: 700,
      };

      const plan = negotiatePlayback(media, weak, {
        maxWidth: 1280,
        maxHeight: 720,
        maxVideoBitrateKbps: 2500,
        maxAudioBitrateKbps: null,
      });

      expect(plan.video.reason.code).not.toBe('UserForcedTranscode');
    });

    it('never loosens the bitrate beyond the device profile, whatever was pinned', () => {
      const weak: DeviceProfile = {
        ...profile,
        maxWidth: 640,
        maxHeight: 360,
        maxBitrateKbps: 700,
      };

      const plan = negotiatePlayback(media, weak, {
        maxWidth: 2560,
        maxHeight: 1440,
        maxVideoBitrateKbps: 8000,
        maxAudioBitrateKbps: null,
      });

      expect(plan.video).toMatchObject({ maxBitrateKbps: 700 });
    });

    it('lets a pinned rung ask for more picture than the screen, as every service does', () => {
      const smallScreen: DeviceProfile = { ...profile, maxWidth: 1920, maxHeight: 1080 };

      const plan = negotiatePlayback(media, smallScreen, {
        maxWidth: 3840,
        maxHeight: 2160,
        maxVideoBitrateKbps: 15_000,
        maxAudioBitrateKbps: null,
      });

      expect(plan.video).toMatchObject({ maxWidth: 3840, maxHeight: 2160 });
    });

    it('leaves the original at its own size, a rung being the deliberate part', () => {
      const smallScreen: DeviceProfile = { ...profile, maxWidth: 1920, maxHeight: 1080 };

      const plan = negotiatePlayback(media, smallScreen, null);

      expect(plan.video.kind).toBe('passthrough');
    });

    it('sizes an encode for the screen once a rung has asked for one', () => {
      const smallScreen: DeviceProfile = { ...profile, maxWidth: 1920, maxHeight: 1080 };

      const plan = negotiatePlayback(media, smallScreen, {
        maxWidth: 1280,
        maxHeight: 720,
        maxVideoBitrateKbps: 3000,
        maxAudioBitrateKbps: null,
      });

      expect(plan.video).toMatchObject({ kind: 'transcode', maxWidth: 1280, maxHeight: 720 });
    });

    it('leaves audio alone when the clamp does not compress it', () => {
      const plan = negotiatePlayback(media, profile, {
        maxWidth: 1920,
        maxHeight: 1080,
        maxVideoBitrateKbps: 4500,
        maxAudioBitrateKbps: null,
      });

      expect(plan.audio.kind).toBe('passthrough');
    });

    it('forces audio compression when the clamp asks for it', () => {
      const plan = negotiatePlayback(media, profile, {
        maxWidth: 854,
        maxHeight: 480,
        maxVideoBitrateKbps: 1000,
        maxAudioBitrateKbps: 128,
      });

      expect(plan.audio).toMatchObject({ kind: 'transcode', maxBitrateKbps: 128 });
      expect(plan.audio.reason.code).toBe('UserForcedTranscode');
    });

    it('uses the compressed bitrate even when audio must transcode for another reason', () => {
      const noTrueHd: DeviceProfile = {
        ...profile,
        directPlayProfiles: [
          { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['aac'] },
        ],
      };

      const plan = negotiatePlayback(media, noTrueHd, {
        maxWidth: 854,
        maxHeight: 480,
        maxVideoBitrateKbps: 1000,
        maxAudioBitrateKbps: 128,
      });

      expect(plan.audio).toMatchObject({ kind: 'transcode', maxBitrateKbps: 128 });
      expect(plan.audio.reason.code).toBe('AudioCodecNotSupported');
    });
  });

  it('leaves audio alone on a file that has none', () => {
    const plan = negotiatePlayback({ ...media, audioStreams: [] }, profile);

    expect(plan.audio).toMatchObject({
      kind: 'passthrough',
      streamIndex: null,
      reason: { code: 'ClientSupportsSource' },
    });
  });

  describe('a codec nobody listed', () => {
    it('transcodes a video codec no client claims rather than refusing the file', () => {
      const plan = negotiatePlayback({ ...media, videoCodec: 'mpeg4' }, profile);

      expect(plan.video.kind).toBe('transcode');
      expect(plan.video.reason.code).toBe('VideoCodecNotSupported');
    });

    it('transcodes an audio codec no client claims', () => {
      const plan = negotiatePlayback(
        {
          ...media,
          audioStreams: [{ index: 1, codec: 'mp2', channels: 2, isDefault: true, isAtmos: false }],
        },
        profile,
      );

      expect(plan.audio.kind).toBe('transcode');
      expect(plan.audio.reason.code).toBe('AudioCodecNotSupported');
    });

    it('remuxes a container Flux could not name', () => {
      const plan = negotiatePlayback({ ...media, container: 'unknown' }, profile);

      expect(plan.container.kind).not.toBe('directPlay');
    });

    it('holds for a codec that does not exist yet', () => {
      const plan = negotiatePlayback({ ...media, videoCodec: 'ffv2' }, profile);

      expect(plan.video.kind).toBe('transcode');
      expect(plan.video.reason.code).toBe('VideoCodecNotSupported');
    });
  });
});
