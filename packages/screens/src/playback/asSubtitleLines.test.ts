import { describe, expect, it } from 'vitest';
import { asSubtitleLines } from './asSubtitleLines';

const WEB_VTT = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.000', 'Hello there', ''].join('\n');

describe('reading a plain subtitle file as lines of the same shape a script gives', () => {
  it('keeps the words and when they are said', () => {
    const [line] = asSubtitleLines(WEB_VTT);

    expect(line?.from).toBe(1);
    expect(line?.to).toBe(3);
    expect(line?.spans[0]?.text).toBe('Hello there');
  });

  it('dresses them in nothing, there being nothing in the file to read', () => {
    const [line] = asSubtitleLines(WEB_VTT);

    expect(line?.spans[0]).toMatchObject({
      fontFamily: null,
      fontHeight: null,
      colour: null,
      isBold: false,
    });
  });

  it('calls none of them a sign, so every one takes the viewer’s own preferences', () => {
    expect(asSubtitleLines(WEB_VTT).every((line) => !line.isSign)).toBe(true);
  });

  it('leaves them where the player puts them', () => {
    expect(asSubtitleLines(WEB_VTT)[0]?.position).toBeNull();
    expect(asSubtitleLines(WEB_VTT)[0]?.alignment).toBe(2);
  });

  it('finds nothing in a file that is not one, without failing', () => {
    expect(asSubtitleLines('')).toEqual([]);
  });
});
