import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EpisodeMenu } from './EpisodeMenu'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const episodeOf = (number: number, changes: Partial<MediaSummary> = {}): MediaSummary => ({
  id: `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`,
  libraryId: '00000000-0000-4000-8000-000000000000',
  title: `Episode ${number.toString()}`,
  year: 2026,
  durationSeconds: 1500,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  videoRange: 'SDR',
  addedAt: '2026-01-01T00:00:00.000Z',
  hasPoster: false,
  hasBackdrop: false,
  seriesTitle: 'Some Show',
  seasonNumber: 1,
  episodeNumber: number,
  ...changes,
})

const SEASON = [episodeOf(1), episodeOf(2), episodeOf(3)]

const open = async (actor: ReturnType<typeof userEvent.setup>) => {
  await actor.click(screen.getByRole('button', { name: 'Episodes' }))
}

describe('EpisodeMenu', () => {
  it('is not drawn at all for a film, since a control that can do nothing is furniture', () => {
    render(<EpisodeMenu episodes={[]} playingId="whatever" onSelect={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Episodes' })).not.toBeInTheDocument()
  })

  it('names the season it is showing', async () => {
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[0]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)

    expect(await screen.findByRole('heading', { name: 'Season 1' })).toBeInTheDocument()
  })

  it('lists the whole season, including the one playing', async () => {
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[0]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)

    expect(await screen.findByRole('button', { name: /Episode 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Episode 3/ })).toBeInTheDocument()
  })

  it('says which one is on screen', async () => {
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[1]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)

    expect(await screen.findByRole('button', { name: /Episode 2.*Playing/ })).toBeInTheDocument()
  })

  it('says how long the others are, which is what somebody is judging', async () => {
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[1]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)

    expect(await screen.findByRole('button', { name: /Episode 1.*25:00/ })).toBeInTheDocument()
  })

  it('reports the episode that was picked', async () => {
    const onSelect = vi.fn()
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[0]?.id ?? ''} onSelect={onSelect} />)
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Episode 3/ }))

    expect(onSelect).toHaveBeenCalledWith(SEASON[2])
  })

  it('closes on the way, since a list should not sit over what it opened', async () => {
    const actor = userEvent.setup()

    render(<EpisodeMenu episodes={SEASON} playingId={SEASON[0]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)
    await actor.click(await screen.findByRole('button', { name: /Episode 3/ }))

    expect(screen.queryByRole('heading', { name: 'Season 1' })).not.toBeInTheDocument()
  })

  it('says when it opens, so the bar underneath can stay up', async () => {
    const onOpenChange = vi.fn()
    const actor = userEvent.setup()

    render(
      <EpisodeMenu
        episodes={SEASON}
        playingId={SEASON[0]?.id ?? ''}
        onSelect={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    )
    await open(actor)

    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('shows how far through each one this viewer is', async () => {
    const actor = userEvent.setup()
    const { container } = render(
      <EpisodeMenu
        episodes={SEASON}
        playingId={SEASON[0]?.id ?? ''}
        onSelect={vi.fn()}
        watchedFractionFor={(mediaId) => (mediaId === SEASON[1]?.id ? 0.5 : undefined)}
      />,
    )

    await open(actor)
    await screen.findByRole('heading', { name: 'Season 1' })

    expect(container.ownerDocument.body.innerHTML).toContain('50%')
  })

  it('calls itself episodes where a file says nothing about a season', async () => {
    const actor = userEvent.setup()
    const loose = [episodeOf(1, { seasonNumber: null }), episodeOf(2, { seasonNumber: null })]

    render(<EpisodeMenu episodes={loose} playingId={loose[0]?.id ?? ''} onSelect={vi.fn()} />)
    await open(actor)

    expect(await screen.findByRole('heading', { name: 'Episodes' })).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(EpisodeMenu.displayName).toBe('EpisodeMenu')
  })
})
