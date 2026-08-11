/**
 * Language codes seen in the wild, mapped to the two-letter form.
 *
 * Files carry two-letter codes, three-letter codes, both of the two competing
 * three-letter standards, and sometimes the language written out. All of them
 * mean the same thing to a viewer.
 */
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

/**
 * How a language is written for the person reading it.
 */
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

/**
 * The values files use to mean "nobody said".
 */
const UNKNOWN_LANGUAGES = new Set(['', 'und', 'unknown', 'zxx', 'mul', 'mis']);

/**
 * How many channels are described as what.
 *
 * "5.1" is what is printed on the box and what a viewer is choosing between.
 * "6ch" is how many discrete streams the decoder sees, which is a fact about
 * the decoder rather than about the sound.
 */
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
 * Normalises whatever a file called a language into a two-letter code.
 *
 * Answers with nothing when the file said nothing, or said one of the several
 * things that mean nothing.
 */
const readLanguage = (raw: string | null | undefined): string | null => {
  const lowered = (raw ?? '').trim().toLowerCase();

  if (UNKNOWN_LANGUAGES.has(lowered)) {
    return null;
  }

  return LANGUAGE_CODES[lowered] ?? lowered;
};

/**
 * Names a language for a viewer.
 *
 * An unrecognised code is shown as written rather than replaced with a guess:
 * a viewer who sees `tlh` at least learns something true about the file.
 */
const describeLanguage = (raw: string | null | undefined): string | null => {
  const code = readLanguage(raw);

  if (code === null) {
    return null;
  }

  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
};

/**
 * Describes a channel count the way it is sold.
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
 * Names an audio track for a menu.
 *
 * Real files are inconsistent about this in every possible way: many carry no
 * language at all, many carry `und`, and two tracks of the same language are
 * routinely distinguished only by a title like "Commentary". So the name is
 * built from whatever the file actually said, in descending order of how much
 * it tells a viewer, and falls back to the track's position rather than
 * calling everything "Unknown".
 *
 * `position` is which audio track this is, counting from one, not the stream
 * index — a viewer has no idea what stream 3 of a container is.
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

export type { AudioTrackFacts };

export {
  describeAudioTrack,
  describeLanguage,
  describeChannels,
  readLanguage,
  LANGUAGE_NAMES,
  LANGUAGE_CODES,
  CHANNEL_NAMES,
};
