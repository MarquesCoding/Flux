import { describe, expect, it } from 'vitest';
import { toCuePlacement } from './toCuePlacement';
import type { SubtitleCue } from '@ValenceClient/playback/fetchSubtitleCues';

const cueOf = (over: Partial<SubtitleCue> = {}): SubtitleCue => ({
  from: 0,
  to: 1,
  spans: [],
  alignment: 2,
  position: null,
  margins: { left: 0, right: 0, vertical: 0 },
  isSign: false,
  ...over,
});

describe('where on the picture a line goes', () => {
  it('puts dialogue where the player wants it, not where the file says', () => {
    const placed = toCuePlacement(cueOf({ position: { x: 0.9, y: 0.1 }, alignment: 9 }), '8%');

    expect(placed.box).toEqual({ left: 0, right: 0, bottom: '8%' });
    expect(placed.justify).toBe('center');
  });

  it('lifts dialogue clear of the controls when it is told to', () => {
    expect(toCuePlacement(cueOf(), '18%').box.bottom).toBe('18%');
  });

  it('puts a positioned sign at the point the script named', () => {
    const placed = toCuePlacement(
      cueOf({ isSign: true, position: { x: 0.75, y: 0.2 }, alignment: 7 }),
      '8%',
    );

    expect(placed.box).toMatchObject({ left: '75%', top: '20%' });
  });

  it('hangs a sign from the corner its alignment names, not from its top left', () => {
    const topLeft = toCuePlacement(
      cueOf({ isSign: true, position: { x: 0.5, y: 0.5 }, alignment: 7 }),
      '8%',
    );

    const bottomRight = toCuePlacement(
      cueOf({ isSign: true, position: { x: 0.5, y: 0.5 }, alignment: 3 }),
      '8%',
    );

    const middle = toCuePlacement(
      cueOf({ isSign: true, position: { x: 0.5, y: 0.5 }, alignment: 5 }),
      '8%',
    );

    expect(topLeft.box.transform).toBe('translate(0, 0)');
    expect(bottomRight.box.transform).toBe('translate(-100%, -100%)');
    expect(middle.box.transform).toBe('translate(-50%, -50%)');
  });

  it('lines the text up under the corner it hangs from', () => {
    expect(toCuePlacement(cueOf({ isSign: true, alignment: 7 }), '8%').justify).toBe('flex-start');
    expect(toCuePlacement(cueOf({ isSign: true, alignment: 8 }), '8%').justify).toBe('center');
    expect(toCuePlacement(cueOf({ isSign: true, alignment: 9 }), '8%').justify).toBe('flex-end');
  });

  it('pushes an unpositioned sign against the edge its alignment names', () => {
    const top = toCuePlacement(
      cueOf({ isSign: true, alignment: 8, margins: { left: 0.05, right: 0.05, vertical: 0.1 } }),
      '8%',
    );

    expect(top.box).toEqual({ left: '5%', right: '5%', top: '10%' });
  });

  it('centres an unpositioned sign told to sit in the middle', () => {
    const middle = toCuePlacement(cueOf({ isSign: true, alignment: 4 }), '8%');

    expect(middle.box).toMatchObject({ top: '50%', transform: 'translateY(-50%)' });
  });

  it('survives an alignment outside the nine, rather than placing a line nowhere', () => {
    expect(() => toCuePlacement(cueOf({ isSign: true, alignment: 42 }), '8%')).not.toThrow();
    expect(toCuePlacement(cueOf({ isSign: true, alignment: 0 }), '8%').justify).toBe('flex-start');
  });
});
