const LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  eng: 'en',
  en: 'en',
  french: 'fr',
  fre: 'fr',
  fra: 'fr',
  fr: 'fr',
  german: 'de',
  ger: 'de',
  deu: 'de',
  de: 'de',
  spanish: 'es',
  spa: 'es',
  es: 'es',
  italian: 'it',
  ita: 'it',
  it: 'it',
  japanese: 'ja',
  jpn: 'ja',
  ja: 'ja',
  korean: 'ko',
  kor: 'ko',
  ko: 'ko',
  dutch: 'nl',
  dut: 'nl',
  nld: 'nl',
  nl: 'nl',
  portuguese: 'pt',
  por: 'pt',
  pt: 'pt',
  russian: 'ru',
  rus: 'ru',
  ru: 'ru',
  chinese: 'zh',
  chi: 'zh',
  zho: 'zh',
  zh: 'zh',
  polish: 'pl',
  pol: 'pl',
  pl: 'pl',
  swedish: 'sv',
  swe: 'sv',
  sv: 'sv',
  danish: 'da',
  dan: 'da',
  da: 'da',
  norwegian: 'no',
  nor: 'no',
  no: 'no',
  finnish: 'fi',
  fin: 'fi',
  fi: 'fi',
  arabic: 'ar',
  ara: 'ar',
  ar: 'ar',
  hindi: 'hi',
  hin: 'hi',
  hi: 'hi',
  turkish: 'tr',
  tur: 'tr',
  tr: 'tr',
  czech: 'cs',
  cze: 'cs',
  ces: 'cs',
  cs: 'cs',
  greek: 'el',
  gre: 'el',
  ell: 'el',
  el: 'el',
  hebrew: 'he',
  heb: 'he',
  he: 'he',
  hungarian: 'hu',
  hun: 'hu',
  hu: 'hu',
  thai: 'th',
  tha: 'th',
  th: 'th',
  ukrainian: 'uk',
  ukr: 'uk',
  uk: 'uk',
  vietnamese: 'vi',
  vie: 'vi',
  vi: 'vi',
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nl: 'Nederlands',
  pt: 'Português',
  ru: 'Русский',
  zh: '中文',
  pl: 'Polski',
  sv: 'Svenska',
  da: 'Dansk',
  no: 'Norsk',
  fi: 'Suomi',
  ar: 'العربية',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  cs: 'Čeština',
  el: 'Ελληνικά',
  he: 'עברית',
  hu: 'Magyar',
  th: 'ไทย',
  uk: 'Українська',
  vi: 'Tiếng Việt',
};

const UNKNOWN_LANGUAGES = new Set(['', 'und', 'unknown', 'zxx', 'mul', 'mis']);

const CHANNEL_NAMES: Record<number, string> = {
  1: 'Mono',
  2: 'Stereo',
  3: '2.1',
  4: 'Quad',
  6: '5.1',
  7: '6.1',
  8: '7.1',
  10: '9.1',
  12: '11.1',
};

/**
 * Normalises whatever a file called a language into a two-letter code. Files carry two-letter codes,
 * three-letter codes, both competing three-letter standards, and sometimes the language written out
 * in full; all of them mean the same thing to a viewer and are answered with the same code here.
 *
 * @param raw - The language as the file tagged it, in any spelling, or nothing at all.
 * @returns The two-letter code, or null where the tag was absent or meant "nobody said".
 */
const readLanguage = (raw: string | null | undefined): string | null => {
  const lowered = (raw ?? '').trim().toLowerCase();

  if (UNKNOWN_LANGUAGES.has(lowered)) {
    return null;
  }

  return LANGUAGE_CODES[lowered] ?? lowered;
};

/**
 * Names a language the way a viewer reads it, in that language's own words — Deutsch rather than
 * German. A code nothing recognises is shown upper-cased rather than replaced by a guess, so
 * somebody seeing `TLH` at least learns something true about the file.
 *
 * @param raw - The language as the file tagged it, in any spelling.
 * @returns The name to show, or null where the file named no language.
 */
const describeLanguage = (raw: string | null | undefined): string | null => {
  const code = readLanguage(raw);

  if (code === null) {
    return null;
  }

  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
};

/**
 * Describes a channel count the way it is printed on a box rather than the way a decoder counts:
 * six discrete streams are `5.1` to everybody choosing what to listen to. A count with no common
 * name falls back to the number followed by `ch`.
 *
 * @param channels - How many discrete audio channels the track carries.
 * @returns The arrangement as it is sold, such as `5.1` or `Stereo`.
 */
const describeChannels = (channels: number): string =>
  CHANNEL_NAMES[channels] ?? `${channels.toString()}ch`;

type AudioTrackFacts = {
  index: number;
  codec: string;
  channels: number;
  language?: string | null | undefined;
  title?: string | null | undefined;
  isAtmos?: boolean | undefined;
  isDefault?: boolean | undefined;
};

/**
 * Names one audio track for a menu of them, built from whatever the file actually said and in
 * descending order of how much it tells a viewer: the language, then any title distinguishing two
 * tracks of the same language, then the channel arrangement and either Atmos or the codec. Real
 * files are inconsistent about all of this, so a track naming nothing falls back to its position
 * rather than to the word "Unknown".
 *
 * @param track - What the file says about this track: codec, channels, language, title and whether
 *   it is Atmos.
 * @param position - Which audio track this is, counting from one — not the stream index, which
 *   means nothing to a viewer.
 * @returns The line to show in a menu.
 */
const describeAudioTrack = (track: AudioTrackFacts, position: number): string => {
  const language = describeLanguage(track.language);
  const title = track.title?.trim() ?? '';

  const saysLanguage = language !== null && title.toLowerCase().includes(language.toLowerCase());

  const named =
    title === ''
      ? (language ?? `Track ${position.toString()}`)
      : language === null || saysLanguage
        ? title
        : `${language} · ${title}`;

  const qualities = [
    describeChannels(track.channels),
    track.isAtmos === true ? 'Atmos' : track.codec.toUpperCase(),
  ];

  return `${named} · ${qualities.join(' · ')}`;
};

type SelectableAudioStream = {
  index: number;
  language?: string | null | undefined;
  isDefault?: boolean | undefined;
};

/**
 * Picks which of a file's audio streams to play, preferring one language where the library has been
 * told to. A file with nothing in that language is left exactly as it would have been without any
 * preference at all — its own default, or its first — so a preference that does not apply to this
 * file cannot break it. Shared by playback negotiation and the scanner's preview generation so the
 * two never disagree about the same file.
 *
 * @param streams - The file's audio streams, in the order the container lists them.
 * @param preferredLanguage - The language to prefer, in any spelling, or nothing to take the file's
 *   own choice.
 * @returns The stream to play, or undefined for a file carrying no audio at all.
 */
const selectAudioStream = <TStream extends SelectableAudioStream>(
  streams: TStream[],
  preferredLanguage?: string | null,
): TStream | undefined => {
  const preferred =
    preferredLanguage === null || preferredLanguage === undefined
      ? null
      : readLanguage(preferredLanguage);

  const matching =
    preferred === null
      ? undefined
      : streams.find((stream) => readLanguage(stream.language) === preferred);

  return matching ?? streams.find((stream) => stream.isDefault === true) ?? streams[0];
};

export type { AudioTrackFacts };

export {
  describeAudioTrack,
  describeLanguage,
  describeChannels,
  readLanguage,
  selectAudioStream,
  LANGUAGE_NAMES,
};
