import { describe, expect, it } from 'vitest'
import createChapterSegmentProviderModule from './createChapterSegmentProvider'
import type { SegmentCandidate } from './SegmentProvider'
import type { MediaProbe } from '@FluxServer/transcoder/TranscoderClient'

const { createChapterSegmentProvider, readChapterKind } = createChapterSegmentProviderModule

const probe = (chapters: MediaProbe['chapters']): MediaProbe => ({
  container: 'mkv',
  durationSeconds: 1440,
  bitrateKbps: 4000,
  video: null,
  audioStreams: [],
  subtitleStreams: [],
  chapters,
})

const candidate = (chapters: MediaProbe['chapters']): SegmentCandidate => ({
  mediaId: 'media-1',
  path: '/media/Some Show/Season 1/S01E01.mkv',
  probe: probe(chapters),
  durationSeconds: 1440,
})

describe('readChapterKind', () => {
  it('recognises the names an intro is given', () => {
    for (const name of ['Intro', 'Opening', 'OP', 'Theme', 'opening credits']) {
      expect(readChapterKind(name)).toBe('intro')
    }
  })

  it('recognises a recap', () => {
    expect(readChapterKind('Previously On')).toBe('recap')
  })

  it('recognises credits', () => {
    expect(readChapterKind('End Credits')).toBe('credits')
  })

  it('refuses to guess at a name that says nothing', () => {
    for (const name of ['Part 1', 'Chapter 2', 'Scene 4', '']) {
      expect(readChapterKind(name)).toBeNull()
    }
  })

  it('refuses a chapter with no name at all', () => {
    expect(readChapterKind(null)).toBeNull()
  })

  it('does not match a name that merely contains the word', () => {
    expect(readChapterKind('The Introduction of Doubt')).toBeNull()
  })
})

describe('createChapterSegmentProvider', () => {
  it('reads a named intro straight off the container', async () => {
    const found = await createChapterSegmentProvider().detect([
      candidate([
        { title: 'Intro', startSeconds: 12, endSeconds: 102 },
        { title: 'Episode', startSeconds: 102, endSeconds: 1380 },
      ]),
    ])

    expect(found.get('media-1')).toEqual([
      { kind: 'intro', startSeconds: 12, endSeconds: 102, source: 'chapters' },
    ])
  })

  it('reads several kinds from one file', async () => {
    const found = await createChapterSegmentProvider().detect([
      candidate([
        { title: 'Previously', startSeconds: 0, endSeconds: 30 },
        { title: 'Intro', startSeconds: 30, endSeconds: 120 },
        { title: 'Credits', startSeconds: 1300, endSeconds: 1440 },
      ]),
    ])

    expect(found.get('media-1')?.map((segment) => segment.kind)).toEqual([
      'recap',
      'intro',
      'credits',
    ])
  })

  it('says nothing about a file whose chapters are unnamed', async () => {
    const found = await createChapterSegmentProvider().detect([
      candidate([{ title: 'Chapter 1', startSeconds: 0, endSeconds: 300 }]),
    ])

    expect(found.size).toBe(0)
  })

  it('says nothing about a file with no chapters', async () => {
    const found = await createChapterSegmentProvider().detect([candidate([])])

    expect(found.size).toBe(0)
  })
})
