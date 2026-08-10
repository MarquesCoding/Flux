import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconHome, IconSearch } from '@tabler/icons-react'
import DockModule from './Dock'

const { Dock } = DockModule

const items = [
  { id: 'home', label: 'Home', icon: <IconHome aria-hidden /> },
  { id: 'search', label: 'Search', icon: <IconSearch aria-hidden /> },
]

describe('Dock', () => {
  it('names itself so it can be skipped past', () => {
    render(<Dock items={items} selectedId="home" onSelect={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
  })

  it('names every place it can take you, which icons alone do not', () => {
    render(<Dock items={items} selectedId="home" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('says where the viewer is', () => {
    render(<Dock items={items} selectedId="search" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('moves on request', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Dock items={items} selectedId="home" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onSelect).toHaveBeenCalledWith('search')
  })

  it('keeps a thumb sized target on a phone', () => {
    render(<Dock items={items} selectedId="home" onSelect={vi.fn()} />)

    // Three rem on a phone, slightly tighter once there is a pointer.
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('size-12')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Dock.displayName).toBe('Dock')
  })
})
