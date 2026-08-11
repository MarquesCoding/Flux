import { describe, expect, it } from 'vitest'
import {
  findSidecarSubtitles,
  describeTags,
  describeLabel,
  splitName,
} from './findSidecarSubtitles'
import type { SidecarFile } from './findSidecarSubtitles'

const file = (name: string): SidecarFile => ({ path: `/media/films/${name}`, name })

const VIDEO = 'Arrival (2016).mkv'

describe('splitName', () => {
  it('separates a name from its extension', () => {
    expect(splitName('Arrival (2016).en.srt')).toEqual({
      stem: 'Arrival (2016).en',
      extension: 'srt',
    })
  })

  it('treats a name with no extension as all stem', () => {
    expect(splitName('README')).toEqual({ stem: 'README', extension: '' })
  })

  it('does not mistake a leading dot for an extension', () => {
    expect(splitName('.hidden')).toEqual({ stem: '.hidden', extension: '' })
  })
})

describe('describeTags', () => {
  it('reads a two letter language', () => {
    expect(describeTags(['en'])).toMatchObject({ language: 'en' })
  })

  it('reads a three letter language as the two letter code', () => {
    expect(describeTags(['ger'])).toMatchObject({ language: 'de' })
  })

  it('reads a language written out in full', () => {
    expect(describeTags(['Spanish'])).toMatchObject({ language: 'es' })
  })

  it('notices a forced track', () => {
    expect(describeTags(['en', 'forced'])).toMatchObject({ language: 'en', isForced: true })
  })

  it('notices a track for the hard of hearing', () => {
    expect(describeTags(['en', 'sdh'])).toMatchObject({ isHearingImpaired: true })
  })

  it('does not mistake a marker for a language', () => {
    expect(describeTags(['forced', 'fr'])).toMatchObject({ language: 'fr', isForced: true })
  })

  it('carries an unrecognised language through rather than guessing', () => {
    expect(describeTags(['tlh'])).toMatchObject({ language: 'tlh' })
  })

  it('reports no language when the filename says nothing', () => {
    expect(describeTags([])).toMatchObject({ language: null })
  })
})

describe('describeLabel', () => {
  it('names a language the way a viewer reads it', () => {
    expect(describeLabel('de', false, false)).toBe('Deutsch')
  })

  it('says so when a track is forced', () => {
    expect(describeLabel('en', true, false)).toBe('English (forced)')
  })

  it('says so when a track is for the hard of hearing', () => {
    expect(describeLabel('en', false, true)).toBe('English (SDH)')
  })

  it('falls back to the code it was given', () => {
    expect(describeLabel('tlh', false, false)).toBe('TLH')
  })

  it('admits when it does not know the language', () => {
    expect(describeLabel(null, false, false)).toBe('Unknown')
  })
})

describe('findSidecarSubtitles', () => {
  it('finds a track named after the video', () => {
    const found = findSidecarSubtitles(VIDEO, [file('Arrival (2016).en.srt')])

    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ language: 'en', format: 'srt', label: 'English' })
  })

  it('finds a track with no language in its name', () => {
    const found = findSidecarSubtitles(VIDEO, [file('Arrival (2016).srt')])

    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ language: null, label: 'Unknown' })
  })

  it('finds every language beside the video', () => {
    const found = findSidecarSubtitles(VIDEO, [
      file('Arrival (2016).en.srt'),
      file('Arrival (2016).fr.srt'),
      file('Arrival (2016).de.forced.ass'),
    ])

    expect(found.map((track) => track.label)).toEqual(['English', 'Français', 'Deutsch (forced)'])
  })

  it('ignores subtitles belonging to a different video', () => {
    const found = findSidecarSubtitles(VIDEO, [file('Dune (2021).en.srt')])

    expect(found).toHaveLength(0)
  })

  it('ignores the video itself and anything else in the folder', () => {
    const found = findSidecarSubtitles(VIDEO, [
      file(VIDEO),
      file('Arrival (2016).nfo'),
      file('poster.jpg'),
    ])

    expect(found).toHaveLength(0)
  })

  it('ignores picture based tracks, which cannot be turned into text', () => {
    const found = findSidecarSubtitles(VIDEO, [
      file('Arrival (2016).en.sup'),
      file('Arrival (2016).en.idx'),
      file('Arrival (2016).en.sub'),
    ])

    expect(found).toHaveLength(0)
  })

  it('takes every track in a subtitle directory as belonging to the video', () => {
    const found = findSidecarSubtitles(VIDEO, [file('English.srt'), file('French.forced.srt')], {
      fromSubtitleDirectory: true,
    })

    expect(found.map((track) => track.label)).toEqual(['English', 'Français (forced)'])
  })

  it('does not mistake a longer title for the same one', () => {
    const found = findSidecarSubtitles('Arrival.mkv', [file('Arrival 2.en.srt')])

    expect(found).toHaveLength(0)
  })
})
