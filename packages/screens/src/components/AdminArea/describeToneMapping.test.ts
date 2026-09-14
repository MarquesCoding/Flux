import { describe, expect, it } from 'vitest';
import { describeToneMapping } from './describeToneMapping';

describe('describeToneMapping', () => {
  it('names the filters the card proved rather than the one behind them', () => {
    const mapper = describeToneMapping('libplacebo', ['tonemap_vaapi', 'vpp_qsv']);

    expect(mapper.label).toBe('tonemap_vaapi, vpp_qsv on the device');
  });

  it('warns about nothing where the card converts and software stands behind it', () => {
    expect(describeToneMapping('libplacebo', ['tonemap_vaapi']).detail).toBeNull();
  });

  it('says which software mapper does the work where the card does none', () => {
    expect(describeToneMapping('libplacebo', []).label).toBe('libplacebo, in software');
    expect(describeToneMapping('zscale', []).label).toBe('zscale, in software');
  });

  it('never reads as working where nothing can convert at all', () => {
    const mapper = describeToneMapping('unavailable', []);

    expect(mapper.label).toBe('None');
    expect(mapper.detail).toContain('washed out');
  });

  it('says what a card with no software behind it cannot cover', () => {
    const mapper = describeToneMapping('unavailable', ['tonemap_videotoolbox']);

    expect(mapper.label).toBe('tonemap_videotoolbox on the device');
    expect(mapper.detail).toContain('passed through untouched');
  });

  it('tells the two machines Valence is built and shipped on apart', () => {
    expect(describeToneMapping('zscale', []).label).not.toBe(
      describeToneMapping('libplacebo', []).label,
    );
  });
});
