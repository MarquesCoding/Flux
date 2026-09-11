import { describe, expect, it } from 'vitest';
import { describeChains } from '@ValenceScreens/components/AdminArea/describeChains';

const chain = (
  accel: string,
  shape: 'preview' | 'sheet' | 'transcode',
  bitDepth: number,
  works: boolean,
  reason: string | null = null,
) => ({ accel, shape, bitDepth, works, reason });

describe('describeChains', () => {
  it('says nothing was checked where nothing was', () => {
    const said = describeChains([]);

    expect(said.label).toBe('Not checked');
    expect(said.tone).toBe('quiet');
    expect(said.refusals).toEqual([]);
  });

  it('counts what was proved against what was tried', () => {
    const said = describeChains([
      chain('qsv', 'preview', 8, true),
      chain('qsv', 'sheet', 8, true),
      chain('qsv', 'transcode', 10, true),
    ]);

    expect(said.label).toBe('3 of 3 proved');
    expect(said.tone).toBe('quiet');
  });

  it('warns where a chain refused, and says which work it was', () => {
    const said = describeChains([
      chain('qsv', 'preview', 8, true),
      chain('vaapi', 'sheet', 10, false, 'Impossible to convert between the formats'),
    ]);

    expect(said.label).toBe('1 of 2 proved');
    expect(said.tone).toBe('warning');
    expect(said.refusals).toEqual([
      {
        id: 'vaapi-sheet-10',
        what: 'vaapi cannot draw thumbnail sheets at 10 bits',
        reason: 'Impossible to convert between the formats',
      },
    ]);
  });

  it('says so where a chain refused without saying why', () => {
    const [refusal] = describeChains([chain('qsv', 'transcode', 10, false)]).refusals;

    expect(refusal?.reason).toBe('It produced nothing, and said nothing about why.');
  });

  it('tells the depths apart, because one can run where the other cannot', () => {
    const said = describeChains([
      chain('qsv', 'preview', 8, true),
      chain('qsv', 'preview', 10, false, 'Invalid output format nv12'),
    ]);

    expect(said.refusals.map((refusal) => refusal.what)).toEqual([
      'qsv cannot draw scrub previews at 10 bits',
    ]);
  });
});
