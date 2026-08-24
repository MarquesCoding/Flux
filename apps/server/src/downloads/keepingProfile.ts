import type { DeviceProfile } from '@ValenceContracts/schemas/DeviceProfile';

/**
 * What a file being kept is encoded for.
 *
 * Not the device that asked. A stream is negotiated against the thing about to play it, because it
 * is about to play it; a kept file outlives that entirely — copied to a phone, watched on a laptop,
 * handed to somebody else — so it is made for the widest thing that plays rather than the narrowest
 * thing that asked.
 *
 * H.264 and AAC in MP4, which is the combination every device made this century will open. It is
 * not the most efficient: HEVC would be a third smaller for the same picture. But a download that
 * will not open is worth nothing at all, and the one place somebody finds that out is the place
 * they cannot do anything about it.
 *
 * Anything the source already is and this can carry is copied rather than re-encoded, which the
 * negotiator works out from this exactly as it does for a stream — so a file that is already H.264
 * in MP4 is a copy, and takes seconds rather than an hour.
 *
 * @returns The profile a kept file is made for.
 */
const keepingProfile = (): DeviceProfile => ({
  schemaVersion: 1,
  name: 'A file to keep',
  directPlayProfiles: [{ container: 'mp4', videoCodecs: ['h264'], audioCodecs: ['aac', 'mp3'] }],
  transcodingProfiles: [
    { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', protocol: 'http' },
  ],
  supportedSubtitleFormats: ['srt', 'webvtt', 'ass', 'ssa'],
  supportedVideoRanges: ['SDR'],
  maxVideoLevels: {},
  tenBitVideoCodecs: [],
  unsupportedAudioProfiles: [],
  maxAudioChannels: 6,
  maxWidth: 3840,
  maxHeight: 2160,
  canPlayInterlaced: false,
  canPlayAnamorphic: false,
  canRotate: false,
});

export { keepingProfile };
