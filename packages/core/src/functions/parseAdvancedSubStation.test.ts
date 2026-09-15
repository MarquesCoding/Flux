import { describe, expect, it } from 'vitest';
import { parseAdvancedSubStation } from './parseAdvancedSubStation';

const SCRIPT = [
  '[Script Info]',
  'Title: A film',
  'PlayResX: 1920',
  'PlayResY: 1080',
  '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, Underline, StrikeOut, Alignment, MarginL, MarginR, MarginV',
  'Style: Default,Arial,48,&H00FFFFFF,0,0,0,0,2,96,96,54',
  'Style: Sign,Impact,72,&H000000FF,-1,0,0,0,7,0,0,0',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  "Dialogue: 0,0:01:22.30,0:01:25.10,Default,,0,0,0,,I'll be back by six.",
  'Dialogue: 0,0:01:30.00,0:01:34.00,Sign,,0,0,0,,{\\pos(1440,216)}CLOSED',
].join('\n');

const parsed = parseAdvancedSubStation(SCRIPT);

describe('reading an Advanced SubStation script', () => {
  it('reads the lines and when they are said', () => {
    expect(parsed.cues).toHaveLength(2);
    expect(parsed.cues[0]?.from).toBeCloseTo(82.3, 2);
    expect(parsed.cues[0]?.to).toBeCloseTo(85.1, 2);
  });

  it('keeps the words', () => {
    expect(parsed.cues[0]?.spans.map((span) => span.text).join('')).toBe("I'll be back by six.");
    expect(parsed.cues[1]?.spans.map((span) => span.text).join('')).toBe('CLOSED');
  });

  it('dresses a line in the style it named, rather than ignoring the styles section', () => {
    expect(parsed.cues[0]?.spans[0]).toMatchObject({
      fontFamily: 'Arial',
      fontSize: 48,
      colour: '#ffffff',
      isBold: false,
    });

    expect(parsed.cues[1]?.spans[0]).toMatchObject({
      fontFamily: 'Impact',
      fontSize: 72,
      colour: '#ff0000',
      isBold: true,
    });
  });

  it('puts a positioned line where the script put it, as a fraction of the picture', () => {
    expect(parsed.cues[1]?.position?.x).toBeCloseTo(0.75, 3);
    expect(parsed.cues[1]?.position?.y).toBeCloseTo(0.2, 3);
  });

  it('leaves dialogue unpositioned, for whatever draws it to place', () => {
    expect(parsed.cues[0]?.position).toBeNull();
  });

  it('calls a positioned line a sign and an ordinary one not', () => {
    expect(parsed.cues[0]?.isSign).toBe(false);
    expect(parsed.cues[1]?.isSign).toBe(true);
  });

  it('reads margins as fractions of the picture too', () => {
    expect(parsed.cues[0]?.margins.left).toBeCloseTo(0.05, 3);
    expect(parsed.cues[0]?.margins.vertical).toBeCloseTo(0.05, 3);
  });
});

describe('what a script says about where a line sits', () => {
  const withEvents = (...events: string[]) =>
    parseAdvancedSubStation(
      [
        '[V4+ Styles]',
        'Format: Name, Alignment',
        'Style: Default,2',
        'Style: Top,8',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        ...events,
      ].join('\n'),
    );

  it('treats a line aligned away from the bottom centre as a sign', () => {
    const { cues } = withEvents('Dialogue: 0,0:00:01.00,0:00:02.00,Top,,A notice');

    expect(cues[0]?.alignment).toBe(8);
    expect(cues[0]?.isSign).toBe(true);
  });

  it('treats a line at the bottom centre as dialogue, which is where dialogue goes', () => {
    const { cues } = withEvents('Dialogue: 0,0:00:01.00,0:00:02.00,Default,,Spoken');

    expect(cues[0]?.alignment).toBe(2);
    expect(cues[0]?.isSign).toBe(false);
  });

  it('lets a line override the alignment its style asked for', () => {
    const { cues } = withEvents('Dialogue: 0,0:00:01.00,0:00:02.00,Default,,{\\an9}Up there');

    expect(cues[0]?.alignment).toBe(9);
    expect(cues[0]?.isSign).toBe(true);
  });
});

describe('the lettering changing partway through a line', () => {
  const spansOf = (text: string) =>
    parseAdvancedSubStation(
      [
        '[V4+ Styles]',
        'Format: Name, Fontname, Italic',
        'Style: Default,Arial,0',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        `Dialogue: 0,0:00:01.00,0:00:02.00,Default,,${text}`,
      ].join('\n'),
    ).cues[0]?.spans ?? [];

  it('splits a line where an override changes it, rather than dressing all of it the same', () => {
    const spans = spansOf('plain {\\i1}italic{\\i0} plain again');

    expect(spans.map((span) => [span.text, span.isItalic])).toEqual([
      ['plain ', false],
      ['italic', true],
      [' plain again', false],
    ]);
  });

  it('starts over from the line’s own style when told to', () => {
    const spans = spansOf('{\\i1}italic{\\r}back to normal');

    expect(spans[1]?.isItalic).toBe(false);
  });

  it('keeps a line that is nothing but an override block from becoming an empty line', () => {
    expect(spansOf('{\\i1}')).toHaveLength(0);
  });

  it('turns the script’s own line breaks into real ones', () => {
    expect(spansOf('one\\Ntwo')[0]?.text).toBe('one\ntwo');
  });

  it('leaves the words when it cannot draw what was asked for', () => {
    expect(spansOf('{\\t(0,500,\\frz360)\\p1}spinning')[0]?.text).toBe('spinning');
  });
});

describe('scripts that are not the tidy case', () => {
  it('falls back to the format’s own resolution where the script declares none', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,{\\pos(192,144)}Middle',
      ].join('\n'),
    );

    expect(cues[0]?.position?.x).toBeCloseTo(0.5, 3);
    expect(cues[0]?.position?.y).toBeCloseTo(0.5, 3);
  });

  it('reads the columns from the Format line rather than from where they usually are', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[Events]',
        'Format: Start, End, Text, Style',
        'Dialogue: 0:00:01.00,0:00:02.00,Backwards,Default',
      ].join('\n'),
    );

    expect(cues[0]?.spans[0]?.text).toBe('Backwards');
  });

  it('keeps the commas in a line that contains them, the text being the last column', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,Yes, and then, no',
      ].join('\n'),
    );

    expect(cues[0]?.spans[0]?.text).toBe('Yes, and then, no');
  });

  it('numbers the older section’s alignments the older way', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[V4 Styles]',
        'Format: Name, Alignment',
        'Style: Default,6',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,Up top',
      ].join('\n'),
    );

    expect(cues[0]?.alignment).toBe(8);
  });

  it('drops a line whose timestamps make no sense rather than showing it at zero', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        'Dialogue: 0,whenever,0:00:02.00,Default,,Nonsense',
      ].join('\n'),
    );

    expect(cues).toHaveLength(0);
  });

  it('reads a line naming a style the script never defined, rather than dropping it', () => {
    const { cues } = parseAdvancedSubStation(
      [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, Text',
        'Dialogue: 0,0:00:01.00,0:00:02.00,Missing,,Still said',
      ].join('\n'),
    );

    expect(cues[0]?.spans[0]?.text).toBe('Still said');
    expect(cues[0]?.isSign).toBe(false);
  });

  it('finds nothing in a file that is not a script, without failing', () => {
    expect(parseAdvancedSubStation('this is not a subtitle file').cues).toEqual([]);
    expect(parseAdvancedSubStation('').cues).toEqual([]);
  });
});
