import { describe, expect, it } from 'vitest';
import { previewRequestFor } from './previewRequestFor';
import type { AudioStream } from '@ValenceContracts/schemas/MediaItem';

const stream = (index: number, language: string | null): AudioStream => ({
  index,
  codec: 'aac',
  channels: 2,
  language,
  title: null,
  isDefault: index === 0,
  isAtmos: false,
});

const subject = {
  path: '/media/arrival.mkv',
  audioStreams: [stream(0, 'eng'), stream(1, 'deu')],
};

describe('the request that addresses a preview clip', () => {
  it('carries the file and the generation', () => {
    expect(previewRequestFor(subject, 4, null, 'high')).toEqual({
      inputPath: '/media/arrival.mkv',
      generation: 4,
      quality: 'high',
    });
  });

  it('leaves the stream to ffmpeg when the library forces no language', () => {
    expect(previewRequestFor(subject, 0, null, 'high')).not.toHaveProperty('audioStreamIndex');
  });

  it('names the stream when the library forces a language', () => {
    expect(previewRequestFor(subject, 0, 'deu', 'high')).toMatchObject({ audioStreamIndex: 1 });
  });

  it('still names a stream when the forced language is not there', () => {
    expect(previewRequestFor(subject, 0, 'fra', 'high')).toMatchObject({ audioStreamIndex: 0 });
  });

  it('addresses the same clip twice for the same inputs', () => {
    expect(previewRequestFor(subject, 2, 'deu', 'high')).toEqual(
      previewRequestFor(subject, 2, 'deu', 'high'),
    );
  });

  it('addresses a different clip once the generation moves', () => {
    expect(previewRequestFor(subject, 2, 'deu', 'high')).not.toEqual(
      previewRequestFor(subject, 3, 'deu', 'high'),
    );
  });

  it('addresses a different clip for a different forced language', () => {
    expect(previewRequestFor(subject, 0, 'eng', 'high')).not.toEqual(
      previewRequestFor(subject, 0, 'deu', 'high'),
    );
  });
  it('carries the preset the clip is made at', () => {
    expect(previewRequestFor(subject, 0, null, 'low')).toMatchObject({ quality: 'low' });
  });

  it('addresses a different clip at a different preset', () => {
    expect(previewRequestFor(subject, 0, null, 'low')).not.toEqual(
      previewRequestFor(subject, 0, null, 'high'),
    );
  });
});
