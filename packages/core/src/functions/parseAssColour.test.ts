import { describe, expect, it } from 'vitest';
import { parseAssAlpha, parseAssColour } from './parseAssColour';

describe('reading a colour the way Advanced SubStation writes one', () => {
  it('reads the channels backwards, because the format stores them that way', () => {
    expect(parseAssColour('&H000000FF')).toEqual({ colour: '#ff0000', opacity: 1 });
    expect(parseAssColour('&H00FF0000')).toEqual({ colour: '#0000ff', opacity: 1 });
    expect(parseAssColour('&H0000FF00')).toEqual({ colour: '#00ff00', opacity: 1 });
  });

  it('reads white and black, which is most of what a style row carries', () => {
    expect(parseAssColour('&H00FFFFFF')?.colour).toBe('#ffffff');
    expect(parseAssColour('&H00000000')?.colour).toBe('#000000');
  });

  it('counts the first pair as transparency, not opacity', () => {
    expect(parseAssColour('&HFF0000FF')?.opacity).toBe(0);
    expect(parseAssColour('&H800000FF')?.opacity).toBeCloseTo(0.498, 2);
  });

  it('says nothing about opacity where the script only named a colour', () => {
    expect(parseAssColour('&HFF0000&')).toEqual({ colour: '#0000ff', opacity: null });
    expect(parseAssColour('&HFF0000')).toEqual({ colour: '#0000ff', opacity: null });
  });

  it('reads the decimal an old script writes the same number as', () => {
    expect(parseAssColour('16777215')?.colour).toBe('#ffffff');
    expect(parseAssColour('255')?.colour).toBe('#ff0000');
  });

  it('pads a colour a script wrote short rather than reading it crooked', () => {
    expect(parseAssColour('&HFF&')?.colour).toBe('#ff0000');
  });

  it('refuses anything that is not a colour', () => {
    expect(parseAssColour('')).toBeNull();
    expect(parseAssColour('red')).toBeNull();
    expect(parseAssColour('&HZZZZZZ&')).toBeNull();
  });

  it('reads a transparency on its own, counting up from opaque', () => {
    expect(parseAssAlpha('&H00&')).toBe(1);
    expect(parseAssAlpha('&HFF&')).toBe(0);
    expect(parseAssAlpha('&H80&')).toBeCloseTo(0.498, 2);
  });

  it('refuses a transparency that is not one', () => {
    expect(parseAssAlpha('half')).toBeNull();
  });
});
