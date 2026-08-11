import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MediaFactsModule from './MediaFacts'
import type { MediaSummary } from '@FluxContracts/schemas/Library'

const { MediaFacts } = MediaFactsModule

const media: MediaSummary = {
  id: 'media-1',
  libraryId: 'library-1',
  title: 'Arrival',
  year: 2016,
  durationSeconds: 7200,
  width: 1920,
  height: 1080,
  videoCodec: 'hevc',
  videoRange: 'SDR',
  addedAt: '2026-08-10T00:00:00.000Z',
  hasPoster: true,
  hasBackdrop: true,
}

describe('MediaFacts', () => {
  it('says when it was made', () => {
    render(<MediaFacts media={media} />)

    expect(screen.getByText('2016')).toBeInTheDocument()
  })

  it('says where it sits in its series', () => {
    render(<MediaFacts media={{ ...media, seasonNumber: 2, episodeNumber: 5 }} />)

    expect(screen.getByText('EP5')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
  })

  it('says what it scored, to one place', () => {
    render(<MediaFacts media={{ ...media, rating: 8.14 }} />)

    expect(screen.getByText('8.1')).toBeInTheDocument()
  })

  it('leaves out what is not known rather than showing it empty', () => {
    render(<MediaFacts media={{ ...media, year: null }} />)

    expect(screen.queryByText('EP')).not.toBeInTheDocument()
    expect(screen.queryByText('2016')).not.toBeInTheDocument()
  })

  it('says nothing at all when nothing is known', () => {
    const { container } = render(<MediaFacts media={{ ...media, year: null }} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('holds its tongue about the runtime unless asked', () => {
    render(<MediaFacts media={media} />)

    expect(screen.queryByText('2:00:00')).not.toBeInTheDocument()
  })

  it('says how long it runs where a page has room for it', () => {
    render(<MediaFacts media={media} hasRuntime />)

    expect(screen.getByText('2:00:00')).toBeInTheDocument()
  })

  it('separates the facts, so they read as a list', () => {
    const { container } = render(<MediaFacts media={{ ...media, rating: 8 }} />)

    expect(container.textContent).toContain('·')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(MediaFacts.displayName).toBe('MediaFacts')
  })
})
