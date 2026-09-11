import { describe, expect, it } from 'vitest';
import { PREVIEW_QUALITIES, PreviewQualitySchema } from './PreviewQuality';

describe('PreviewQualitySchema', () => {
  it('knows the three presets, from smallest to sharpest', () => {
    expect(PREVIEW_QUALITIES).toEqual(['low', 'standard', 'high']);
  });

  it('reads each preset by name', () => {
    for (const quality of PREVIEW_QUALITIES) {
      expect(PreviewQualitySchema.parse(quality)).toBe(quality);
    }
  });

  it('refuses a preset that does not exist', () => {
    expect(PreviewQualitySchema.safeParse('ultra').success).toBe(false);
  });
});
