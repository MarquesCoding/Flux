import { describe, expect, it } from 'vitest';
import { parseAssOverrides } from './parseAssOverrides';

const read = (block: string) => parseAssOverrides(block, false);

describe('reading the overrides a line carries in braces', () => {
  it('reads the switches that turn lettering on and off', () => {
    expect(read('\\b1\\i1\\u1\\s1').style).toEqual({
      isBold: true,
      isItalic: true,
      isUnderlined: true,
      isStruckThrough: true,
    });

    expect(read('\\b0\\i0').style).toEqual({ isBold: false, isItalic: false });
  });

  it('reads a numbered weight as bold where it is heavy enough to be', () => {
    expect(read('\\b700').style.isBold).toBe(true);
    expect(read('\\b400').style.isBold).toBe(false);
  });

  it('reads the primary colour, by either of the two names it goes by', () => {
    expect(read('\\c&HFF0000&').style.colour).toBe('#0000ff');
    expect(read('\\1c&H0000FF&').style.colour).toBe('#ff0000');
  });

  it('reads a transparency, by either of the two names it goes by', () => {
    expect(read('\\alpha&HFF&').style.opacity).toBe(0);
    expect(read('\\1a&H00&').style.opacity).toBe(1);
  });

  it('reads a font by name and a size by number', () => {
    expect(read('\\fnImpact\\fs72').style).toEqual({ fontFamily: 'Impact', fontSize: 72 });
  });

  it('reads where the line goes, which belongs to the line and not to the lettering', () => {
    expect(read('\\pos(1400,180)').position).toEqual({ x: 1400, y: 180 });
    expect(read('\\pos( 12.5 , 30 )').position).toEqual({ x: 12.5, y: 30 });
  });

  it('reads an alignment as a keypad position', () => {
    expect(read('\\an7').alignment).toBe(7);
    expect(parseAssOverrides('\\a6', true).alignment).toBe(8);
  });

  it('notices a line told to start over from its style', () => {
    expect(read('\\r').isReset).toBe(true);
    expect(read('\\b1').isReset).toBe(false);
  });

  it('takes several tags out of one block', () => {
    const found = read('\\pos(100,200)\\an5\\i1\\c&H00FF00&\\fs40');

    expect(found.position).toEqual({ x: 100, y: 200 });
    expect(found.alignment).toBe(5);
    expect(found.style).toEqual({ isItalic: true, colour: '#00ff00', fontSize: 40 });
  });

  it('ignores what a browser cannot draw rather than leaving the codes in', () => {
    const found = read('\\move(0,0,100,100)\\t(0,500,\\frz360)\\p1\\k50\\blur4\\fscx120\\shad3');

    expect(found).toEqual({ style: {}, alignment: null, position: null, isReset: false });
  });

  it('does not mistake a tag that merely starts the same way for another', () => {
    expect(read('\\blur4').style.isBold).toBeUndefined();
    expect(read('\\iclip(1,2,3,4)').style.isItalic).toBeUndefined();
    expect(read('\\fscx120').style.fontSize).toBeUndefined();
    expect(read('\\shad2').style.isStruckThrough).toBeUndefined();
    expect(read('\\alpha&H80&').alignment).toBeNull();
  });

  it('lets a later tag win over an earlier one, since that is the order they apply in', () => {
    expect(read('\\i1\\i0').style.isItalic).toBe(false);
    expect(read('\\c&HFF0000&\\c&H00FF00&').style.colour).toBe('#00ff00');
  });

  it('finds nothing in an empty block, and says so without failing', () => {
    expect(read('')).toEqual({ style: {}, alignment: null, position: null, isReset: false });
  });
});
