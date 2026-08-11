import { describe, expect, it } from 'vitest'
import pickFeaturedModule from './pickFeatured'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { pickFeatured, isEarlier, findSiblings } = pickFeaturedModule

let counter = 0

const itemOf = (changes: Partial<MediaSummary> = {}): MediaSummary => {
  counter += 1

  return {
    id: `00000000-0000-4000-8000-${counter.toString().padStart(12, '0')}`,
    libraryId: '00000000-0000-4000-8000-000000000000',
    title: 'Something',
    year: 2020,
    durationSeconds: 3600,
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    videoRange: 'sdr',
    addedAt: '2026-01-01T00:00:00.000Z',
    hasPoster: false,
    hasBackdrop: false,
    ...changes,
  }
}

const episodeOf = (series: string, season: number, episode: number): MediaSummary =>
  itemOf({
    title: `${series} S${season.toString()}E${episode.toString()}`,
    seriesTitle: series,
    seasonNumber: season,
    episodeNumber: episode,
  })

describe('isEarlier', () => {
  it('puts an earlier season first', () => {
    expect(isEarlier(episodeOf('Show', 1, 9), episodeOf('Show', 2, 1))).toBe(true)
  })

  it('puts an earlier episode of the same season first', () => {
    expect(isEarlier(episodeOf('Show', 1, 1), episodeOf('Show', 1, 2))).toBe(true)
  })

  it('does not call a later episode earlier', () => {
    expect(isEarlier(episodeOf('Show', 2, 1), episodeOf('Show', 1, 9))).toBe(false)
  })
})

describe('pickFeatured', () => {
  it('lets a film stand for itself', () => {
    const film = itemOf({ title: 'Parasite' })

    expect(pickFeatured([film], 10)).toEqual([film])
  })

  it('shows a series once rather than once per episode', () => {
    const featured = pickFeatured(
      [episodeOf('Show', 1, 1), episodeOf('Show', 1, 2), episodeOf('Show', 1, 3)],
      10,
    )

    expect(featured).toHaveLength(1)
  })

  it('introduces a series at its first episode', () => {
    const first = episodeOf('Show', 1, 1)
    const featured = pickFeatured([episodeOf('Show', 1, 9), first, episodeOf('Show', 2, 1)], 10)

    expect(featured).toEqual([first])
  })

  it('keeps a show where its first file appeared, not where its first episode did', () => {
    const film = itemOf({ title: 'Parasite' })
    const featured = pickFeatured([episodeOf('Show', 1, 9), film, episodeOf('Show', 1, 1)], 10)

    expect(featured.map((item) => item.seriesTitle ?? item.title)).toEqual(['Show', 'Parasite'])
  })

  it('keeps two different shows apart', () => {
    const featured = pickFeatured([episodeOf('One', 1, 1), episodeOf('Two', 1, 1)], 10)

    expect(featured).toHaveLength(2)
  })

  it('stops at the number asked for', () => {
    expect(pickFeatured([itemOf(), itemOf(), itemOf()], 2)).toHaveLength(2)
  })

  it('has nothing to feature from nothing', () => {
    expect(pickFeatured([], 5)).toEqual([])
  })
})

describe('findSiblings', () => {
  it('finds the rest of the season', () => {
    const open = episodeOf('Show', 1, 2)
    const siblings = findSiblings([episodeOf('Show', 1, 1), open, episodeOf('Show', 1, 3)], open)

    expect(siblings).toHaveLength(2)
  })

  it('leaves out the episode being read about', () => {
    const open = episodeOf('Show', 1, 2)
    const siblings = findSiblings([episodeOf('Show', 1, 1), open], open)

    expect(siblings.map((item) => item.id)).not.toContain(open.id)
  })

  it('puts them in broadcast order', () => {
    const open = episodeOf('Show', 1, 1)
    const siblings = findSiblings([open, episodeOf('Show', 1, 3), episodeOf('Show', 1, 2)], open)

    expect(siblings.map((item) => item.episodeNumber)).toEqual([2, 3])
  })

  it('does not stray into another season', () => {
    const open = episodeOf('Show', 1, 1)
    const siblings = findSiblings([open, episodeOf('Show', 2, 1)], open)

    expect(siblings).toEqual([])
  })

  it('does not stray into another show', () => {
    const open = episodeOf('Show', 1, 1)
    const siblings = findSiblings([open, episodeOf('Other', 1, 2)], open)

    expect(siblings).toEqual([])
  })

  it('finds nothing for a film, which is not part of anything', () => {
    const film = itemOf()

    expect(findSiblings([film, itemOf()], film)).toEqual([])
  })
})
