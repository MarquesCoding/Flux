import { describe, expect, it } from 'vitest'
import groupIntoRailsModule from './groupIntoRails'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { groupIntoRails, describeSeason, inBroadcastOrder } = groupIntoRailsModule

const NOW = Date.parse('2026-08-10T00:00:00.000Z')

const daysAgo = (days: number): string => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()

const media = (overrides: Partial<MediaSummary> = {}): MediaSummary => ({
  id: overrides.id ?? 'media-1',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: daysAgo(1),
  hasPoster: false,
  hasBackdrop: false,
  accentColor: null,
  seriesTitle: null,
  seasonNumber: null,
  episodeNumber: null,
  ...overrides,
})

const episode = (
  series: string,
  season: number,
  number: number,
  id = `${series}-${season}-${number}`,
) =>
  media({
    id,
    title: `${series} ${season.toString()}x${number.toString()}`,
    seriesTitle: series,
    seasonNumber: season,
    episodeNumber: number,
  })

describe('describeSeason', () => {
  it('says a season the way someone would say it', () => {
    expect(describeSeason('Some Show', 2)).toBe('Some Show · Season 2')
  })

  it('calls season zero what it actually is', () => {
    expect(describeSeason('Some Show', 0)).toBe('Some Show · Specials')
  })

  it('names a series with no season by itself', () => {
    expect(describeSeason('Some Show', null)).toBe('Some Show')
  })
})

describe('inBroadcastOrder', () => {
  it('puts episode two before episode ten, which sorting by name does not', () => {
    const ordered = [episode('S', 1, 10), episode('S', 1, 2)].sort(inBroadcastOrder)

    expect(ordered[0]?.episodeNumber).toBe(2)
  })

  it('puts an earlier season first', () => {
    const ordered = [episode('S', 2, 1), episode('S', 1, 9)].sort(inBroadcastOrder)

    expect(ordered[0]?.seasonNumber).toBe(1)
  })
})

describe('groupIntoRails', () => {
  it('has nothing to show for an empty library', () => {
    expect(groupIntoRails([], NOW)).toEqual([])
  })

  it('opens with what arrived recently', () => {
    const rails = groupIntoRails([media({ id: 'a' }), media({ id: 'b', addedAt: daysAgo(2) })], NOW)

    expect(rails[0]?.title).toBe('Recently added')
    expect(rails[0]?.items[0]?.id).toBe('a')
  })

  it('leaves out a library that arrived long ago rather than calling it new', () => {
    const rails = groupIntoRails([media({ addedAt: daysAgo(400) })], NOW)

    expect(rails.map((rail) => rail.title)).not.toContain('Recently added')
  })

  it('gives each season a row of its own', () => {
    const rails = groupIntoRails(
      [
        episode('Some Show', 1, 1),
        episode('Some Show', 1, 2),
        episode('Some Show', 2, 1),
        episode('Some Show', 2, 2),
      ],
      NOW,
    )

    const titles = rails.map((rail) => rail.title)

    expect(titles).toContain('Some Show · Season 1')
    expect(titles).toContain('Some Show · Season 2')
  })

  it('puts a season in the order it is watched', () => {
    const rails = groupIntoRails(
      [episode('Some Show', 1, 10), episode('Some Show', 1, 2), episode('Some Show', 1, 1)],
      NOW,
    )

    const season = rails.find((rail) => rail.title === 'Some Show · Season 1')

    expect(season?.items.map((item) => item.episodeNumber)).toEqual([1, 2, 10])
  })

  it('does not give a lone episode a row to itself', () => {
    const rails = groupIntoRails([episode('Some Show', 1, 1), media({ id: 'film' })], NOW)

    expect(rails.map((rail) => rail.title)).not.toContain('Some Show · Season 1')
  })

  it('keeps a lone episode rather than losing it', () => {
    const rails = groupIntoRails([episode('Some Show', 1, 1, 'only')], NOW)

    expect(rails.flatMap((rail) => rail.items).some((item) => item.id === 'only')).toBe(true)
  })

  it('gathers everything that is not a series', () => {
    const rails = groupIntoRails(
      [media({ id: 'a', title: 'Zulu' }), media({ id: 'b', title: 'Alien' })],
      NOW,
    )

    const everything = rails.find((rail) => rail.id === 'everything')

    expect(everything?.items.map((item) => item.title)).toEqual(['Alien', 'Zulu'])
  })

  it('calls that row Films only when it is not the only row', () => {
    const alone = groupIntoRails([media({ addedAt: daysAgo(400) })], NOW)

    expect(alone[0]?.title).toBe('Everything')
  })

  it('keeps series apart from one another', () => {
    const rails = groupIntoRails(
      [
        episode('Show One', 1, 1),
        episode('Show One', 1, 2),
        episode('Show Two', 1, 1),
        episode('Show Two', 1, 2),
      ],
      NOW,
    )

    expect(rails.filter((rail) => rail.id.startsWith('season:'))).toHaveLength(2)
  })

  it('invents no row it cannot fill', () => {
    // A row that is always empty teaches people to ignore rows, so nothing is
    // offered for what Flux does not know — such as what anyone has watched.
    const rails = groupIntoRails([media()], NOW)

    expect(rails.every((rail) => rail.items.length > 0)).toBe(true)
  })

  it('gives every row a name that stays the same between renders', () => {
    const first = groupIntoRails([episode('S', 1, 1), episode('S', 1, 2)], NOW)
    const second = groupIntoRails([episode('S', 1, 2), episode('S', 1, 1)], NOW)

    expect(first.map((rail) => rail.id)).toEqual(second.map((rail) => rail.id))
  })
})
