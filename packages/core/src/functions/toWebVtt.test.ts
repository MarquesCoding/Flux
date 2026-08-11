import { describe, expect, it } from 'vitest';
import {
  toWebVtt,
  fromSubRip,
  fromAdvancedSubStation,
  formatTimestamp,
  readAssTimestamp,
} from './toWebVtt';

const subRip = ['1', '00:00:01,000 --> 00:00:03,500', 'Line one', '', '2'].join('\n');

const advancedSubStation = [
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Line one',
].join('\n');

describe('formatTimestamp', () => {
  it('writes the shape WebVTT demands', () => {
    expect(formatTimestamp(3725.5)).toBe('01:02:05.500');
  });

  it('never writes a negative time', () => {
    expect(formatTimestamp(-4)).toBe('00:00:00.000');
  });
});

describe('readAssTimestamp', () => {
  it('reads centiseconds, which is all the format carries', () => {
    expect(readAssTimestamp('0:00:03.50')).toBe(3.5);
  });

  it('reports nothing for a field that is not a time', () => {
    expect(readAssTimestamp('Default')).toBeNull();
  });
});

describe('fromSubRip', () => {
  it('declares itself as WebVTT', () => {
    expect(fromSubRip(subRip).startsWith('WEBVTT\n')).toBe(true);
  });

  it('turns the comma in a timestamp into the full stop WebVTT wants', () => {
    expect(fromSubRip(subRip)).toContain('00:00:01.000 --> 00:00:03.500');
  });

  it('keeps the text of every cue', () => {
    expect(fromSubRip(subRip)).toContain('Line one');
  });

  it('pads an hour written with a single digit', () => {
    expect(fromSubRip('1\n0:00:01,000 --> 0:00:02,000\nLine\n')).toContain('00:00:01.000');
  });

  it('survives a file saved with Windows line endings and a byte order mark', () => {
    const windows = `﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nLine\r\n`;

    expect(fromSubRip(windows)).toContain('00:00:01.000 --> 00:00:02.000');
    expect(fromSubRip(windows).startsWith('WEBVTT')).toBe(true);
  });
});

describe('fromAdvancedSubStation', () => {
  it('keeps the dialogue and its timing', () => {
    const converted = fromAdvancedSubStation(advancedSubStation);

    expect(converted).toContain('00:00:01.000 --> 00:00:03.500');
    expect(converted).toContain('Line one');
  });

  it('drops the styling codes, which WebVTT cannot express', () => {
    const styled = advancedSubStation.replace('Line one', '{\\pos(400,570)\\c&HFFFFFF&}Line one');

    expect(fromAdvancedSubStation(styled)).toContain('Line one');
    expect(fromAdvancedSubStation(styled)).not.toContain('\\pos');
  });

  it('reads the format line rather than assuming the column order', () => {
    const reordered = [
      '[Events]',
      'Format: Start, End, Text',
      'Dialogue: 0:00:05.00,0:00:06.00,Later line',
    ].join('\n');

    expect(fromAdvancedSubStation(reordered)).toContain('00:00:05.000 --> 00:00:06.000');
    expect(fromAdvancedSubStation(reordered)).toContain('Later line');
  });

  it('keeps dialogue containing commas whole', () => {
    const commas = advancedSubStation.replace('Line one', 'Wait, stop, listen');

    expect(fromAdvancedSubStation(commas)).toContain('Wait, stop, listen');
  });

  it('turns a hard line break into a real one', () => {
    const broken = advancedSubStation.replace('Line one', 'First\\NSecond');

    expect(fromAdvancedSubStation(broken)).toContain('First\nSecond');
  });

  it('ignores everything that is not dialogue', () => {
    const withHeader = ['[Script Info]', 'Title: Something', advancedSubStation].join('\n');

    expect(fromAdvancedSubStation(withHeader)).not.toContain('Script Info');
  });

  it('produces a valid, empty track when a script has no dialogue', () => {
    expect(fromAdvancedSubStation('[Script Info]\nTitle: Nothing')).toBe('WEBVTT\n\n');
  });
});

describe('toWebVtt', () => {
  it('passes a WebVTT file through untouched', () => {
    const source = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLine\n';

    expect(toWebVtt(source, 'vtt')).toBe(source);
  });

  it('adds the header to a file that somehow lacks one', () => {
    expect(toWebVtt('00:00:01.000 --> 00:00:02.000\nLine', 'vtt').startsWith('WEBVTT')).toBe(true);
  });

  it('converts SubRip', () => {
    expect(toWebVtt(subRip, 'srt')).toContain('00:00:01.000 --> 00:00:03.500');
  });

  it('converts Advanced SubStation', () => {
    expect(toWebVtt(advancedSubStation, 'ass')).toContain('Line one');
  });

  it('converts SubStation Alpha the same way', () => {
    expect(toWebVtt(advancedSubStation, 'ssa')).toContain('Line one');
  });
});
