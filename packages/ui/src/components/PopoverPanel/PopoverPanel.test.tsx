import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PopoverPanel } from './PopoverPanel'

const draw = (props: Partial<Parameters<typeof PopoverPanel>[0]> = {}) =>
  render(
    <PopoverPanel label="Episodes" trigger={<span>list</span>} {...props}>
      <p>Season one</p>
    </PopoverPanel>,
  )

describe('PopoverPanel', () => {
  it('names its control for anybody who cannot see the icon on it', () => {
    draw()

    expect(screen.getByRole('button', { name: 'Episodes' })).toBeInTheDocument()
  })

  it('keeps its contents away until it is opened', () => {
    draw()

    expect(screen.queryByText('Season one')).not.toBeInTheDocument()
  })

  it('shows them when it is', async () => {
    const actor = userEvent.setup()

    draw()

    await actor.click(screen.getByRole('button', { name: 'Episodes' }))

    expect(await screen.findByText('Season one')).toBeInTheDocument()
  })

  it('says what it is about, where the contents do not say it themselves', async () => {
    const actor = userEvent.setup()

    draw({ heading: 'Season 1' })

    await actor.click(screen.getByRole('button', { name: 'Episodes' }))

    expect(await screen.findByRole('heading', { name: 'Season 1' })).toBeInTheDocument()
  })

  it('opens nothing while it is disabled', async () => {
    const actor = userEvent.setup()

    draw({ isDisabled: true })

    await actor.click(screen.getByRole('button', { name: 'Episodes' }))

    expect(screen.queryByText('Season one')).not.toBeInTheDocument()
  })

  it('can be opened by whoever owns it, for a panel something else closes', async () => {
    draw({ isOpen: true, onOpenChange: vi.fn() })

    expect(await screen.findByText('Season one')).toBeInTheDocument()
  })

  it('says when it opens, so what is underneath can stay put', async () => {
    const onOpenChange = vi.fn()
    const actor = userEvent.setup()

    draw({ onOpenChange })

    await actor.click(screen.getByRole('button', { name: 'Episodes' }))

    // The library hands its own details along with the answer, which callers
    // are typed not to see.
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(true)
  })

  it('takes the same glass as the bar it belongs to', async () => {
    const actor = userEvent.setup()

    draw()

    await actor.click(screen.getByRole('button', { name: 'Episodes' }))

    expect((await screen.findByText('Season one')).closest('.flux-glass')).not.toBeNull()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(PopoverPanel.displayName).toBe('PopoverPanel')
  })
})
