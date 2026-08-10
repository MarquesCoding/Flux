/**
 * Subtitle formats Flux can turn into something a browser renders.
 *
 * Deliberately text only. A picture-based track sitting beside a file is a
 * `.sup` or `.idx`/`.sub` pair, and turning those into text means character
 * recognition, which is not a thing to do inside a playback request.
 */
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'ass', 'ssa'])

/**
 * Directories a release commonly hides subtitles in.
 */
const SUBTITLE_DIRECTORIES = new Set(['subs', 'subtitles'])

/**
 * Markers that describe a track rather than name its language.
 */
const FORCED_MARKERS = new Set(['forced'])

const HEARING_IMPAIRED_MARKERS = new Set(['sdh', 'cc', 'hi'])

/**
 * Language names seen beside media, mapped to the codes a browser wants.
 *
 * Only the common ones: anything unrecognised is carried through as written,
 * because a wrong guess is worse than an honest label.
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
}

/**
 * How a language is written for a viewer to read.
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
}

type SidecarFile = {
  path: string
  name: string
}

type SidecarSubtitle = {
  path: string
  format: string
  language: string | null
  label: string
  isForced: boolean
  isHearingImpaired: boolean
}

/**
 * Splits a filename into its stem and extension.
 */
const splitName = (name: string): { stem: string; extension: string } => {
  const dot = name.lastIndexOf('.')

  return dot <= 0
    ? { stem: name, extension: '' }
    : { stem: name.slice(0, dot), extension: name.slice(dot + 1).toLowerCase() }
}

/**
 * Reads what a subtitle filename says about the track.
 *
 * The convention every tool has settled on is the video's name followed by
 * dot-separated tags: `Arrival (2016).en.forced.srt`. Tags may appear in any
 * order and a file may carry none at all.
 */
const describeTags = (
  tags: string[],
): { language: string | null; isForced: boolean; isHearingImpaired: boolean } => {
  let language: string | null = null
  let isForced = false
  let isHearingImpaired = false

  for (const tag of tags) {
    const lowered = tag.toLowerCase()

    if (FORCED_MARKERS.has(lowered)) {
      isForced = true

      continue
    }

    if (HEARING_IMPAIRED_MARKERS.has(lowered)) {
      isHearingImpaired = true

      continue
    }

    if (language === null && lowered !== '') {
      language = LANGUAGE_CODES[lowered] ?? lowered
    }
  }

  return { language, isForced, isHearingImpaired }
}

/**
 * Names a track the way it should appear in a menu.
 */
const describeLabel = (
  language: string | null,
  isForced: boolean,
  isHearingImpaired: boolean,
): string => {
  const base = language === null ? 'Unknown' : (LANGUAGE_NAMES[language] ?? language.toUpperCase())
  const notes = [isForced ? 'forced' : '', isHearingImpaired ? 'SDH' : ''].filter(
    (note) => note !== '',
  )

  return notes.length === 0 ? base : `${base} (${notes.join(', ')})`
}

/**
 * Picks the subtitle files that belong to one video.
 *
 * A file belongs if its name starts with the video's name, which is how every
 * naming convention in use expresses the relationship. Files in a `Subs`
 * directory are taken as belonging to the only video beside them, because
 * that layout usually carries names like `English.srt` with no video name at
 * all.
 */
const findSidecarSubtitles = (
  videoName: string,
  files: SidecarFile[],
  options: { fromSubtitleDirectory?: boolean } = {},
): SidecarSubtitle[] => {
  const { stem } = splitName(videoName)
  const found: SidecarSubtitle[] = []

  for (const file of files) {
    const { stem: fileStem, extension } = splitName(file.name)

    if (!SUBTITLE_EXTENSIONS.has(extension)) {
      continue
    }

    const belongsByName = fileStem === stem || fileStem.startsWith(`${stem}.`)

    if (!belongsByName && options.fromSubtitleDirectory !== true) {
      continue
    }

    const tags = belongsByName
      ? fileStem.slice(stem.length).split('.').filter(Boolean)
      : fileStem.split('.').filter(Boolean)

    const { language, isForced, isHearingImpaired } = describeTags(tags)

    found.push({
      path: file.path,
      format: extension,
      language,
      label: describeLabel(language, isForced, isHearingImpaired),
      isForced,
      isHearingImpaired,
    })
  }

  return found
}

export type { SidecarFile, SidecarSubtitle }

export default {
  findSidecarSubtitles,
  describeTags,
  describeLabel,
  splitName,
  SUBTITLE_EXTENSIONS,
  SUBTITLE_DIRECTORIES,
  LANGUAGE_NAMES,
}
