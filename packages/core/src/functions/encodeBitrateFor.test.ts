import { describe, expect, it } from 'vitest';
import { encodeBitrateFor, efficiencyOf } from './encodeBitrateFor';

describe('efficiencyOf', () => {
  it('weighs the modern codecs against h264', () => {
    expect(efficiencyOf('h264')).toBe(1);
    expect(efficiencyOf('hevc')).toBe(0.6);
    expect(efficiencyOf('vp9')).toBe(0.6);
    expect(efficiencyOf('av1')).toBe(0.5);
  });

  it('treats anything older than h264 as no hungrier than h264', () => {
    expect(efficiencyOf('mpeg2')).toBe(1);
    expect(efficiencyOf('vc1')).toBe(1);
    expect(efficiencyOf('vp8')).toBe(1);
  });
});

describe('encodeBitrateFor', () => {
  it('anchors to the source rather than to what the client would allow', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 8_900,
      sourceCodec: 'h264',
      targetCodec: 'h264',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(8_900);
  });

  it('gives h264 the extra bits it needs to match an hevc source', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 8_900,
      sourceCodec: 'hevc',
      targetCodec: 'h264',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(14_833);
  });

  it('spends fewer bits than the source when encoding to a better codec', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 10_000,
      sourceCodec: 'h264',
      targetCodec: 'av1',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(10_000);
  });

  it('never lets the answer exceed what the client said it can carry', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 18_000,
      sourceCodec: 'hevc',
      targetCodec: 'h264',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(20_000);
  });

  it('holds a source above the ceiling down to the ceiling', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 40_000,
      sourceCodec: 'h264',
      targetCodec: 'h264',
      ceilingKbps: 8_000,
    });

    expect(bitrate).toBe(8_000);
  });

  it('stops scaling once the bits are too many for the gain to show', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 35_000,
      sourceCodec: 'hevc',
      targetCodec: 'h264',
      ceilingKbps: 80_000,
    });

    expect(bitrate).toBe(35_000);
  });

  it('lifts a starved source rather than re-encoding it at its own bitrate', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 1_500,
      sourceCodec: 'h264',
      targetCodec: 'h264',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(3_750);
  });

  it('lifts a very poor source further still', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 800,
      sourceCodec: 'h264',
      targetCodec: 'h264',
      ceilingKbps: 20_000,
    });

    expect(bitrate).toBe(5_000);
  });

  describe.each([
    { from: 'av1', to: 'h264', expected: 20_000 },
    { from: 'av1', to: 'hevc', expected: 12_000 },
    { from: 'av1', to: 'vp9', expected: 12_000 },
    { from: 'hevc', to: 'h264', expected: 16_667 },
    { from: 'vp9', to: 'h264', expected: 16_667 },
    { from: 'mpeg2', to: 'h264', expected: 10_000 },
    { from: 'vc1', to: 'h264', expected: 10_000 },
    { from: 'hevc', to: 'vp9', expected: 10_000 },
    { from: 'h264', to: 'hevc', expected: 10_000 },
    { from: 'h264', to: 'av1', expected: 10_000 },
    { from: 'hevc', to: 'av1', expected: 10_000 },
  ] as const)('from $from to $to', ({ from, to, expected }) => {
    it(`spends ${expected.toString()}kbps for a 10000kbps source`, () => {
      const bitrate = encodeBitrateFor({
        sourceBitrateKbps: 10_000,
        sourceCodec: from,
        targetCodec: to,
        ceilingKbps: 100_000,
      });

      expect(bitrate).toBe(expected);
    });
  });

  it('falls back to the ceiling when the source bitrate is not known', () => {
    const bitrate = encodeBitrateFor({
      sourceBitrateKbps: 0,
      sourceCodec: 'hevc',
      targetCodec: 'h264',
      ceilingKbps: 12_000,
    });

    expect(bitrate).toBe(12_000);
  });
});
