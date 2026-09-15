import { describe, expect, it } from 'vitest';
import { LARGEST, SMALLEST, toSpanStyle } from './toSpanStyle';
import type { SubtitleSpan } from '@ValenceClient/playback/fetchSubtitleCues';

const spanOf = (over: Partial<SubtitleSpan> = {}): SubtitleSpan => ({
  text: 'CLOSED',
  fontFamily: null,
  fontHeight: null,
  colour: null,
  opacity: null,
  isBold: false,
  isItalic: false,
  isUnderlined: false,
  isStruckThrough: false,
  ...over,
});

describe('drawing a run of text the way a script asked', () => {
  it('draws the switches a script turned on', () => {
    expect(toSpanStyle(spanOf({ isBold: true }))).toMatchObject({ fontWeight: 700 });
    expect(toSpanStyle(spanOf({ isItalic: true }))).toMatchObject({ fontStyle: 'italic' });
    expect(toSpanStyle(spanOf({ isUnderlined: true }))).toMatchObject({
      textDecorationLine: 'underline',
    });
  });

  it('draws both decorations where a script asked for both', () => {
    expect(
      toSpanStyle(spanOf({ isUnderlined: true, isStruckThrough: true })).textDecorationLine,
    ).toBe('underline line-through');
  });

  it('leaves the decoration alone where a script asked for neither', () => {
    expect(toSpanStyle(spanOf()).textDecorationLine).toBeUndefined();
  });

  it('takes a colour, which arrived already parsed to six digits', () => {
    expect(toSpanStyle(spanOf({ colour: '#ff0000' })).color).toBe('#ff0000');
  });

  it('sizes a run against the picture rather than against the page', () => {
    expect(toSpanStyle(spanOf({ fontHeight: 0.0667 })).fontSize).toBe('6.67cqh');
  });

  it('will not let a script make text too small to read or big enough to hide the film', () => {
    expect(toSpanStyle(spanOf({ fontHeight: 0.0001 })).fontSize).toBe(`${SMALLEST * 100}cqh`);
    expect(toSpanStyle(spanOf({ fontHeight: 40 })).fontSize).toBe(`${LARGEST * 100}cqh`);
  });

  it('keeps an opacity inside what an opacity can be', () => {
    expect(toSpanStyle(spanOf({ opacity: 2 })).opacity).toBe(1);
    expect(toSpanStyle(spanOf({ opacity: -1 })).opacity).toBe(0);
  });

  it('picks a face from the ones that are there rather than asking for whatever it was told', () => {
    expect(toSpanStyle(spanOf({ fontFamily: 'Impact' })).fontFamily).toContain('Impact');
    expect(toSpanStyle(spanOf({ fontFamily: 'impact' })).fontFamily).toContain('Impact');
  });

  it('ignores a face nothing here has, rather than passing the name through', () => {
    expect(toSpanStyle(spanOf({ fontFamily: 'Some Fansub Font' })).fontFamily).toBeUndefined();
  });

  it('does not let a font name carry anything but a font name', () => {
    const style = toSpanStyle(spanOf({ fontFamily: 'Arial; background: url(http://elsewhere)' }));

    expect(style.fontFamily).toBeUndefined();
  });
});
