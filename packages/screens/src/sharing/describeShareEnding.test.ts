import { describe, expect, it } from 'vitest';
import { describeShareEnding } from './describeShareEnding';
import { SHARE_ENDINGS } from '@ValenceContracts/schemas/Share';

describe('describeShareEnding', () => {
  it('says something different for each of the three ways a link ends', () => {
    const said = SHARE_ENDINGS.map((ending) => describeShareEnding(ending).said);

    expect(new Set(said).size).toBe(SHARE_ENDINGS.length);
  });

  it('gives each ending its own mark, so they do not read as one thing', () => {
    const icons = SHARE_ENDINGS.map((ending) => describeShareEnding(ending).icon);

    expect(new Set(icons).size).toBe(SHARE_ENDINGS.length);
  });

  it('says somebody stopped a withdrawn link without saying who', () => {
    const told = describeShareEnding('withdrawn');

    expect(told.detail).toContain('Somebody stopped it working');
    expect(told.detail).not.toMatch(/administrator|admin|owner/i);
  });

  it('blames nobody for a link that ran out on its own', () => {
    expect(describeShareEnding('expired').detail).not.toMatch(/somebody|whoever sent it stopped/i);
    expect(describeShareEnding('spent').detail).not.toMatch(/somebody|whoever sent it stopped/i);
  });

  it('tells a guest what to do next in every case', () => {
    for (const ending of SHARE_ENDINGS) {
      expect(describeShareEnding(ending).detail).toContain('can send another');
    }
  });
});
