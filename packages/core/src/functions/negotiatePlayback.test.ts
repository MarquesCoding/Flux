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
  supportedSubtitleFormats: ['srt', 'webvtt'],
  directPlayProfiles: [
    { container: 'mkv', videoCodecs: ['hevc', 'h264'], audioCodecs: ['truehd', 'aac'] },
  ],
  transcodingProfiles: [
    { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
  ],
};

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

  it('preserves a supported HDR range through a bitrate transcode', () => {
    const lowBitrate: DeviceProfile = { ...profile, maxBitrateKbps: 8000 };

    const plan = negotiatePlayback(media, lowBitrate);

    expect(plan.video).toMatchObject({ kind: 'transcode', range: 'HDR10' });
    expect(plan.video.reason.code).toBe('VideoBitrateAboveLimit');
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

  it('downmixes to the client channel limit', () => {
    const stereoOnly: DeviceProfile = { ...profile, maxAudioChannels: 2 };

    const plan = negotiatePlayback(media, stereoOnly);

    expect(plan.audio).toMatchObject({ kind: 'transcode', channels: 2 });
    expect(plan.audio.reason.code).toBe('AudioChannelsAboveLimit');
  });

  it('transcodes video when the resolution exceeds the client limit', () => {
    const hd: DeviceProfile = { ...profile, maxWidth: 1920, maxHeight: 1080 };

    const plan = negotiatePlayback(media, hd);

    expect(plan.video.reason.code).toBe('VideoResolutionAboveLimit');
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

    it('never loosens the effective limit beyond the device profile', () => {
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

      expect(plan.video).toMatchObject({ maxWidth: 640, maxHeight: 360, maxBitrateKbps: 700 });
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
});
