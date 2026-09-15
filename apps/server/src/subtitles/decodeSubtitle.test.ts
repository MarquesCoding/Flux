import { describe, expect, it } from 'vitest';
import { CHARSET_BY_LANGUAGE, decodeSubtitle } from './decodeSubtitle';

const encoded = (text: string, charset: string): Uint8Array => {
  if (charset === 'utf-8') {
    return new TextEncoder().encode(text);
  }

  throw new Error(`nothing here encodes ${charset}`);
};

const withByteOrderMark = (mark: number[], text: string, charset: string): Uint8Array =>
  Uint8Array.from([...mark, ...encoded(text, charset)]);

const CYRILLIC_IN_WINDOWS_1251 = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);

const WESTERN_IN_WINDOWS_1252 = Uint8Array.from([0x63, 0x61, 0x66, 0xe9]);

const GREEK_IN_ISO_8859_7 = Uint8Array.from([0xc3, 0xe5, 0xe9, 0xdc]);

describe('reading a subtitle file that need not be UTF-8', () => {
  it('believes a byte order mark over anything it could work out for itself', () => {
    const decoded = decodeSubtitle(withByteOrderMark([0xef, 0xbb, 0xbf], 'Привет', 'utf-8'), 'ru');

    expect(decoded).toEqual({ text: 'Привет', charset: 'utf-8', decidedBy: 'bom' });
  });

  it('reads UTF-16 by its mark, which is not a thing bytes can be asked about', () => {
    const utf16 = Uint8Array.from([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);

    expect(decodeSubtitle(utf16, null)).toEqual({
      text: 'AB',
      charset: 'utf-16le',
      decidedBy: 'bom',
    });
  });

  it('takes a file that decodes cleanly as UTF-8 at its word, mark or no mark', () => {
    const decoded = decodeSubtitle(encoded('Привет', 'utf-8'), 'ru');

    expect(decoded).toEqual({ text: 'Привет', charset: 'utf-8', decidedBy: 'utf8' });
  });

  it('reads plain ASCII as UTF-8 rather than guessing from the language', () => {
    expect(decodeSubtitle(encoded('Hello', 'utf-8'), 'ja').charset).toBe('utf-8');
  });

  it('reads a Russian track that is not UTF-8 as the encoding Russian subtitles come in', () => {
    const decoded = decodeSubtitle(CYRILLIC_IN_WINDOWS_1251, 'ru');

    expect(decoded).toEqual({
      text: 'Привет',
      charset: 'windows-1251',
      decidedBy: 'language',
    });
  });

  it('reads Greek by its own encoding rather than by the western default', () => {
    expect(decodeSubtitle(GREEK_IN_ISO_8859_7, 'el')).toEqual({
      text: 'Γειά',
      charset: 'iso-8859-7',
      decidedBy: 'language',
    });
  });

  it('falls back to windows-1252 where the file names no language', () => {
    expect(decodeSubtitle(WESTERN_IN_WINDOWS_1252, null)).toEqual({
      text: 'café',
      charset: 'windows-1252',
      decidedBy: 'fallback',
    });
  });

  it('falls back where the language is one with no legacy encoding worth guessing', () => {
    expect(decodeSubtitle(WESTERN_IN_WINDOWS_1252, 'hi').decidedBy).toBe('fallback');
  });

  it('reads a western language by the language, which happens to be the fallback too', () => {
    expect(decodeSubtitle(WESTERN_IN_WINDOWS_1252, 'fr')).toEqual({
      text: 'café',
      charset: 'windows-1252',
      decidedBy: 'language',
    });
  });

  it('never fails on bytes, whatever they are, since a subtitle that throws is one nobody sees', () => {
    const rubbish = Uint8Array.from([0xff, 0x00, 0x81, 0xfe, 0x9d]);

    for (const language of [null, ...Object.keys(CHARSET_BY_LANGUAGE)]) {
      expect(() => decodeSubtitle(rubbish, language)).not.toThrow();
    }
  });

  it('knows an encoding for every language the rest of Valence can name', () => {
    for (const charset of Object.values(CHARSET_BY_LANGUAGE)) {
      expect(() => new TextDecoder(charset)).not.toThrow();
    }
  });

  it('reads an empty file as empty rather than as a guess', () => {
    expect(decodeSubtitle(new Uint8Array(), 'ru')).toEqual({
      text: '',
      charset: 'utf-8',
      decidedBy: 'utf8',
    });
  });
});
