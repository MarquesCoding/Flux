import { describe, expect, it } from 'vitest';
import { MediaItemSchema } from './MediaItem';

const validItem = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  title: 'Sample Film',
  year: 2021,
  container: 'mkv',
  durationSeconds: 7200,
  videoCodec: 'hevc',
  videoRange: 'HDR10',
  width: 3840,
  height: 2160,
  bitrateKbps: 24000,
  audioStreams: [{ index: 1, codec: 'truehd', channels: 8, language: 'eng', isAtmos: true }],
  subtitleStreams: [{ index: 2, format: 'pgs', language: 'eng', isForced: false }],
};

describe('MediaItemSchema', () => {
  it('accepts a fully specified item', () => {
    const result = MediaItemSchema.parse(validItem);

    expect(result.title).toBe('Sample Film');
    expect(result.audioStreams[0]?.isAtmos).toBe(true);
  });

  it('accepts an item with no subtitle streams', () => {
    const result = MediaItemSchema.parse({ ...validItem, subtitleStreams: [] });

    expect(result.subtitleStreams).toHaveLength(0);
  });

  it('accepts a stream whose language ffprobe could not determine', () => {
    const result = MediaItemSchema.parse({
      ...validItem,
      audioStreams: [{ index: 1, codec: 'aac', channels: 2, language: null, isAtmos: false }],
      subtitleStreams: [{ index: 2, format: 'srt', language: null, isForced: false }],
    });

    expect(result.audioStreams[0]?.language).toBeNull();
  });

  it('accepts an item with no year', () => {
    expect(MediaItemSchema.parse({ ...validItem, year: null }).year).toBeNull();
  });

  it('rejects an item with no audio streams', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, audioStreams: [] })).toThrow();
  });

  it('accepts a container Valence has no name for', () => {
    expect(MediaItemSchema.parse({ ...validItem, container: 'rmvb' }).container).toBe('rmvb');
  });

  it('accepts a video codec Valence has never heard of', () => {
    expect(MediaItemSchema.parse({ ...validItem, videoCodec: 'theora' }).videoCodec).toBe('theora');
  });

  it('accepts the codecs a real library turned out to hold', () => {
    for (const videoCodec of ['mpeg4', 'mpeg1video']) {
      expect(MediaItemSchema.parse({ ...validItem, videoCodec }).videoCodec).toBe(videoCodec);
    }
  });

  it('accepts an audio codec Valence has never heard of', () => {
    const result = MediaItemSchema.parse({
      ...validItem,
      audioStreams: [{ index: 1, codec: 'mp2', channels: 2, isAtmos: false }],
    });

    expect(result.audioStreams[0]?.codec).toBe('mp2');
  });

  it('still rejects a codec that is not a name at all', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, videoCodec: '' })).toThrow();
  });

  it('rejects a non-uuid id', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects a zero duration', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, durationSeconds: 0 })).toThrow();
  });
});
