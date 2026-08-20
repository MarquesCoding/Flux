import { describe, expect, it } from 'vitest';
import { inPageOrder } from './inPageOrder';

describe('inPageOrder', () => {
  it('puts page nine before page ten, which sorting by character gets backwards', () => {
    expect(inPageOrder(['p10.png', 'p9.png'])).toEqual(['p9.png', 'p10.png']);
  });

  it('orders an archive that lists its pages shuffled, which is what they do', () => {
    const shuffled = ['c033 - p012.png', 'c033 - p001.png', 'c033 - p002.png'];

    expect(inPageOrder(shuffled)).toEqual([
      'c033 - p001.png',
      'c033 - p002.png',
      'c033 - p012.png',
    ]);
  });

  it('keeps a spread where its first page falls, so nothing after it shifts', () => {
    const pages = ['p014.png', 'p012-013.png', 'p011.png'];

    expect(inPageOrder(pages)).toEqual(['p011.png', 'p012-013.png', 'p014.png']);
  });

  it('leaves the names it was given alone', () => {
    const given = ['b.png', 'a.png'];

    inPageOrder(given);

    expect(given).toEqual(['b.png', 'a.png']);
  });
});
