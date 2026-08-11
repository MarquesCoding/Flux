import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileFace } from './ProfileFace'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const pictureOf = (container: HTMLElement) => container.querySelector('img, video')

const createObjectURL = vi.fn().mockReturnValue('blob:chosen')
const revokeObjectURL = vi.fn()

// Defined rather than stubbed: jsdom has neither, and replacing the whole URL
// object would take its parser with it.
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

beforeEach(() => {
  createObjectURL.mockClear().mockReturnValue('blob:chosen')
  revokeObjectURL.mockClear()
})

describe('ProfileFace', () => {
  it('draws the letter of somebody who has not chosen a picture', () => {
    render(<ProfileFace profile={PROFILE} />)

    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('draws the letter on their colour', () => {
    const { container } = render(<ProfileFace profile={PROFILE} />)

    expect(container.firstElementChild?.getAttribute('style')).toContain('rgb(58, 142, 232)')
  })

  it('draws a picture through Flux when there is one', () => {
    const { container } = render(
      <ProfileFace
        profile={{ ...PROFILE, avatar: { kind: 'drawn', style: 'bottts', seed: 'a' } }}
      />,
    )

    expect(pictureOf(container)?.getAttribute('src')).toContain('/api/profiles/')
  })

  it('draws a still photograph as a picture', () => {
    const { container } = render(
      <ProfileFace profile={{ ...PROFILE, avatar: { kind: 'photo', isVideo: false } }} />,
    )

    expect(pictureOf(container)?.tagName).toBe('IMG')
  })

  it('plays a moving picture, which an image tag would draw as nothing', () => {
    const { container } = render(
      <ProfileFace profile={{ ...PROFILE, avatar: { kind: 'photo', isVideo: true } }} />,
    )

    expect(pictureOf(container)?.tagName).toBe('VIDEO')
  })

  it('shows a picture somebody has chosen before they have kept it', () => {
    const { container } = render(
      <ProfileFace profile={PROFILE} pending={new File([''], 'me.webp', { type: 'image/webp' })} />,
    )

    expect(pictureOf(container)?.getAttribute('src')).toBe('blob:chosen')
  })

  it('plays a chosen picture that moves', () => {
    const { container } = render(
      <ProfileFace profile={PROFILE} pending={new File([''], 'me.webm', { type: 'video/webm' })} />,
    )

    expect(pictureOf(container)?.tagName).toBe('VIDEO')
  })

  it('releases a chosen picture rather than holding the file in memory', () => {
    const { unmount } = render(
      <ProfileFace profile={PROFILE} pending={new File([''], 'me.webp', { type: 'image/webp' })} />,
    )

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:chosen')
  })

  it('draws a decorative face, since the name beside it already says who it is', () => {
    const { container } = render(
      <ProfileFace profile={{ ...PROFILE, avatar: { kind: 'photo', isVideo: false } }} />,
    )

    expect(pictureOf(container)).toHaveAttribute('alt', '')
  })
})
