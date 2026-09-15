import { describe, expect, it } from 'vitest';
import { describeSubtitleCharset } from './describeSubtitleCharset';

describe('saying what a subtitle file was read as', () => {
  it('says nothing about a file that carried a mark, since nothing was assumed', () => {
    expect(describeSubtitleCharset({ text: '', charset: 'utf-8', decidedBy: 'bom' })).toBeNull();
  });

  it('says nothing about a file that proved itself UTF-8 by decoding', () => {
    expect(describeSubtitleCharset({ text: '', charset: 'utf-8', decidedBy: 'utf8' })).toBeNull();
  });

  it('names the encoding and the language that chose it', () => {
    expect(
      describeSubtitleCharset({ text: '', charset: 'windows-1251', decidedBy: 'language' }),
    ).toBe('read as windows-1251 (from the track language; not valid UTF-8)');
  });

  it('admits it is a guess where the file named no language', () => {
    expect(
      describeSubtitleCharset({ text: '', charset: 'windows-1252', decidedBy: 'fallback' }),
    ).toBe(
      'read as windows-1252 (a guess, since the file does not name its language; not valid UTF-8)',
    );
  });
});
