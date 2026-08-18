import { describe, expect, it } from 'vitest';
import { deliveredBitrateKbps } from './deliveredBitrateKbps';

describe('deliveredBitrateKbps', () => {
  it('takes the manifest figure where the manifest gives one', () => {
    expect(
      deliveredBitrateKbps({
        declaredBandwidth: 4_500_000,
        bytesFetched: 999,
        mediaSecondsFetched: 999,
      }),
    ).toBe(4500);
  });

  it('measures a window where the manifest declares nothing, which is what Flux serves', () => {
    expect(
      deliveredBitrateKbps({
        declaredBandwidth: 0,
        bytesFetched: 2_500_000,
        mediaSecondsFetched: 10,
      }),
    ).toBe(2000);
  });

  it('reads a seven hundred kilobit stream as seven hundred kilobits', () => {
    expect(
      deliveredBitrateKbps({
        declaredBandwidth: 0,
        bytesFetched: (700 * 1000 * 8) / 8,
        mediaSecondsFetched: 8,
      }),
    ).toBe(700);
  });

  it('is not thrown by an engine that fetched far ahead of the viewer', () => {
    const aheadByAMinute = deliveredBitrateKbps({
      declaredBandwidth: 0,
      bytesFetched: (700 * 1000 * 60) / 8,
      mediaSecondsFetched: 60,
    });

    expect(aheadByAMinute).toBe(700);
  });

  it('treats a declared nought as no answer rather than as an answer of nought', () => {
    expect(
      deliveredBitrateKbps({ declaredBandwidth: 0, bytesFetched: 0, mediaSecondsFetched: 0 }),
    ).toBeNull();
  });

  it('waits for a window worth reading, a fraction of a second being noise', () => {
    expect(
      deliveredBitrateKbps({
        declaredBandwidth: 0,
        bytesFetched: 2_000_000,
        mediaSecondsFetched: 0.2,
      }),
    ).toBeNull();
  });

  it('answers with nothing rather than a number it cannot stand behind', () => {
    const cases: {
      declaredBandwidth: number | null | undefined;
      bytesFetched: number | null | undefined;
      mediaSecondsFetched: number | null | undefined;
    }[] = [
      { declaredBandwidth: null, bytesFetched: null, mediaSecondsFetched: null },
      { declaredBandwidth: undefined, bytesFetched: undefined, mediaSecondsFetched: undefined },
      { declaredBandwidth: 0, bytesFetched: Number.NaN, mediaSecondsFetched: 10 },
      { declaredBandwidth: 0, bytesFetched: 1_000, mediaSecondsFetched: Number.NaN },
      { declaredBandwidth: 0, bytesFetched: -5, mediaSecondsFetched: 10 },
    ];

    for (const options of cases) {
      expect(deliveredBitrateKbps(options)).toBeNull();
    }
  });
});
