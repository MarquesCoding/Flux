import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconHome, IconMovie } from '@tabler/icons-react'
import SideNavModule from './SideNav'
import type { SideNavProps } from './SideNav.types'

const { SideNav } = SideNavModule

const draw = (overrides: Partial<SideNavProps> = {}) => {
  const props: SideNavProps = {
    items: [
      { id: 'home', label: 'Home', icon: <IconHome aria-hidden /> },
      { id: 'films', label: 'Films', icon: <IconMovie aria-hidden /> },
    ],
    selectedId: 'home',
    isExpanded: true,
    onSelect: vi.fn(),
    onToggle: vi.fn(),
    ...overrides,
  }

  render(<SideNav {...props} />)

  return props
}

describe('SideNav', () => {
  it('names itself so it can be skipped past', () => {
    draw()

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
  })

  it('says where the viewer is', () => {
    draw()

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Films' })).not.toHaveAttribute('aria-current')
  })

  it('moves on request', async () => {
    const user = userEvent.setup()
    const props = draw()

    await user.click(screen.getByRole('button', { name: 'Films' }))

    expect(props.onSelect).toHaveBeenCalledWith('films')
  })

  it('keeps every section reachable by name once collapsed', () => {
    draw({ isExpanded: false })

    // The label leaves the screen but not the accessible name, so collapsing
    // costs a screen reader nothing.
    expect(screen.getByRole('button', { name: 'Films' })).toBeInTheDocument()
    expect(screen.queryByText('Films')).not.toBeInTheDocument()
  })

  it('offers to collapse when open', async () => {
    const user = userEvent.setup()
    const props = draw()

    await user.click(screen.getByRole('button', { name: 'Collapse the sidebar' }))

    expect(props.onToggle).toHaveBeenCalledTimes(1)
  })

  it('offers to expand when closed', () => {
    draw({ isExpanded: false })

    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument()
  })

  it('shows the brand only when there is room for it', () => {
    draw({ brand: <span>Flux</span>, isExpanded: false })

    expect(screen.queryByText('Flux')).not.toBeInTheDocument()
  })

  it('keeps the footer through both states', () => {
    draw({ footer: <span>Account</span>, isExpanded: false })

    expect(screen.getByText('Account')).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(SideNav.displayName).toBe('SideNav')
  })
})
