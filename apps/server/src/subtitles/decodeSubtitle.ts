type DecidedBy = 'bom' | 'utf8' | 'language' | 'fallback';

type DecodedSubtitle = {
  text: string;
  charset: string;
  decidedBy: DecidedBy;
};

const FALLBACK_CHARSET = 'windows-1252';

const CHARSET_BY_LANGUAGE: Record<string, string> = {
  ar: 'windows-1256',
  cs: 'windows-1250',
  da: 'windows-1252',
  de: 'windows-1252',
  el: 'iso-8859-7',
  en: 'windows-1252',
  es: 'windows-1252',
  fi: 'windows-1252',
  fr: 'windows-1252',
  he: 'windows-1255',
  hu: 'windows-1250',
  it: 'windows-1252',
  ja: 'shift_jis',
  ko: 'euc-kr',
  nl: 'windows-1252',
  no: 'windows-1252',
  pl: 'windows-1250',
  pt: 'windows-1252',
  ru: 'windows-1251',
  sv: 'windows-1252',
  th: 'windows-874',
  tr: 'windows-1254',
  uk: 'windows-1251',
  vi: 'windows-1258',
  zh: 'gb18030',
};

const BYTE_ORDER_MARKS: { bytes: number[]; charset: string }[] = [
  { bytes: [0xef, 0xbb, 0xbf], charset: 'utf-8' },
  { bytes: [0xff, 0xfe], charset: 'utf-16le' },
  { bytes: [0xfe, 0xff], charset: 'utf-16be' },
];

/**
 * Reads the byte order mark a file opens with, where it has one.
 *
 * @param bytes - The file.
 * @returns The charset the mark names, or null where the file carries no mark.
 */
const charsetFromByteOrderMark = (bytes: Uint8Array): string | null => {
  for (const mark of BYTE_ORDER_MARKS) {
    if (mark.bytes.every((byte, index) => bytes[index] === byte)) {
      return mark.charset;
    }
  }

  return null;
};

/**
 * Whether a file is UTF-8, which is a question bytes can answer for themselves: the encoding is
 * self-validating, and text in a legacy encoding long enough to be a subtitle will not pass by
 * accident.
 *
 * @param bytes - The file.
 * @returns Whether every byte in it is valid UTF-8.
 */
const isUtf8 = (bytes: Uint8Array): boolean => {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    return true;
  } catch {
    return false;
  }
};

/**
 * Reads a subtitle file as text, working out what it was written in rather than assuming UTF-8.
 *
 * Most of what circulates for anything not English is in a legacy encoding, and reading one of those
 * as UTF-8 does not fail — the invalid bytes become replacement characters and the file parses, so
 * mojibake is served with nothing reporting a problem.
 *
 * Three questions, in the order of how much they can be trusted. A byte order mark is the file
 * saying outright what it is and settles it. Failing that, UTF-8 validates itself, so a file that
 * decodes cleanly as UTF-8 is UTF-8. Only then is anything guessed, and the guess is informed: a
 * subtitle usually names its language in its filename, and a language implies the encoding its
 * subtitles are written in far more often than not.
 *
 * What is left over is read as windows-1252. Every byte maps to something there, so a file always
 * reads as something rather than failing, and for the Western European languages that dominate what
 * has no language in its name it is also the right answer.
 *
 * @param bytes - The subtitle file.
 * @param language - The language the track claims, as a two-letter code.
 * @returns The text, the charset it was read as, and what decided that.
 */
const decodeSubtitle = (bytes: Uint8Array, language: string | null): DecodedSubtitle => {
  const marked = charsetFromByteOrderMark(bytes);

  if (marked !== null) {
    return { text: new TextDecoder(marked).decode(bytes), charset: marked, decidedBy: 'bom' };
  }

  if (isUtf8(bytes)) {
    return { text: new TextDecoder('utf-8').decode(bytes), charset: 'utf-8', decidedBy: 'utf8' };
  }

  const claimed = language === null ? undefined : CHARSET_BY_LANGUAGE[language];
  const charset = claimed ?? FALLBACK_CHARSET;

  return {
    text: new TextDecoder(charset).decode(bytes),
    charset,
    decidedBy: claimed === undefined ? 'fallback' : 'language',
  };
};

export type { DecidedBy, DecodedSubtitle };

export { CHARSET_BY_LANGUAGE, FALLBACK_CHARSET, decodeSubtitle };
