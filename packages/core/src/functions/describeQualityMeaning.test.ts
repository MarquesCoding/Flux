import { describe, expect, it } from 'vitest';
import { QUALITY_STEP_IDS } from '@ValenceContracts/schemas/QualityStep';
import { describeQualityMeaning } from './describeQualityMeaning';

describe('describeQualityMeaning', () => {
  it('says what the original is, and that it is the largest', () => {
    expect(describeQualityMeaning('original')).toMatch(/largest/);
  });

  it('anchors a rung to a screen rather than to an adjective', () => {
    expect(describeQualityMeaning('720p')).toMatch(/phone or a tablet/);
  });

  it('has something to say about every rung on offer', () => {
    for (const id of QUALITY_STEP_IDS) {
      expect(describeQualityMeaning(id).length).toBeGreaterThan(0);
    }
  });

  it('says it in one sentence, since a menu is not the place for a paragraph', () => {
    for (const id of QUALITY_STEP_IDS) {
      expect(describeQualityMeaning(id).split('. ').length).toBeLessThanOrEqual(2);
    }
  });
});
