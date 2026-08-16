import { describe, expect, it } from 'vitest';
import { fixtureFacts } from './fixtureFacts';

const probe = (video: Record<string, string | number>, audio: Record<string, string | number>) =>
  JSON.stringify({
    streams: [
      { codec_type: 'video', ...video },
      { codec_type: 'audio', ...audio },
    ],
  });

describe('fixtureFacts', () => {
  it('reads the codecs and channel count off the streams', () => {
    const facts = fixtureFacts(
      probe({ codec_name: 'hevc', pix_fmt: 'yuv420p' }, { codec_name: 'eac3', channels: 6 }),
    );

    expect(facts.videoCodec).toBe('hevc');
    expect(facts.audioCodec).toBe('eac3');
    expect(facts.audioChannels).toBe(6);
  });

  it('reads ten bits from the pixel format', () => {
    expect(fixtureFacts(probe({ pix_fmt: 'yuv420p10le' }, {})).bitDepth).toBe(10);
    expect(fixtureFacts(probe({ pix_fmt: 'yuv420p' }, {})).bitDepth).toBe(8);
  });

  it('reads the range from the transfer curve rather than from a name', () => {
    expect(fixtureFacts(probe({ color_transfer: 'smpte2084' }, {})).range).toBe('HDR10');
    expect(fixtureFacts(probe({ color_transfer: 'arib-std-b67' }, {})).range).toBe('HLG');
    expect(fixtureFacts(probe({ color_transfer: 'bt709' }, {})).range).toBe('SDR');
  });

  it('treats an unstated field order as progressive', () => {
    expect(fixtureFacts(probe({}, {})).scan).toBe('progressive');
    expect(fixtureFacts(probe({ field_order: 'progressive' }, {})).scan).toBe('progressive');
    expect(fixtureFacts(probe({ field_order: 'tt' }, {})).scan).toBe('interlaced');
  });

  it('describes a file with no streams rather than throwing', () => {
    const facts = fixtureFacts(JSON.stringify({ streams: [] }));

    expect(facts.videoCodec).toBe('');
    expect(facts.audioChannels).toBe(0);
  });
});
