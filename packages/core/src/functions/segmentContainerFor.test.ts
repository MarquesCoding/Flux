import { describe, expect, it } from 'vitest';
import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';
import { segmentContainerFor } from './segmentContainerFor';

const profile = (transcodingProfiles: DeviceProfile['transcodingProfiles']): DeviceProfile => ({
  schemaVersion: 1,
  name: 'Browser',
  maxWidth: 1920,
  maxHeight: 1080,
  maxBitrateKbps: 20_000,
  maxAudioChannels: 2,
  supportedVideoRanges: ['SDR'],
  tenBitVideoCodecs: [],
  supportedSubtitleFormats: ['webvtt'],
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac'] }],
  transcodingProfiles,
});

describe('segmentContainerFor', () => {
  it('wraps segments in fragmented MP4 for a client that asks for MP4', () => {
    const container = segmentContainerFor(
      profile([{ container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' }]),
    );

    expect(container).toBe('fmp4');
  });

  it('wraps segments in a transport stream for a client that asks for one', () => {
    const container = segmentContainerFor(
      profile([{ container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' }]),
    );

    expect(container).toBe('mpegts');
  });

  it('reads the streaming profile rather than whichever comes first', () => {
    const container = segmentContainerFor(
      profile([
        { container: 'mkv', videoCodec: 'h264', audioCodec: 'aac', protocol: 'http' },
        { container: 'ts', videoCodec: 'h264', audioCodec: 'aac', protocol: 'hls' },
      ]),
    );

    expect(container).toBe('mpegts');
  });

  it('falls back to fragmented MP4 when no streaming profile is offered', () => {
    const container = segmentContainerFor(
      profile([{ container: 'mkv', videoCodec: 'h264', audioCodec: 'aac', protocol: 'http' }]),
    );

    expect(container).toBe('fmp4');
  });
});
