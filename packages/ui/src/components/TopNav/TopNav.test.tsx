import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TopNav } from './TopNav'

const items = [
  { id: 'home', label: 'Home', icon: <span data-testid="home-icon" /> },
  { id: 'shows', label: 'Shows', icon: <span data-testid="shows-icon" /> },
  { id: 'films', label: 'Films' },
]

describe('TopNav', () => {
  it('names itself, since a page has one way around it', () => {
    render(<TopNav items={items} selectedId="home" onSelect={vi.fn()} />)

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
  })

  it('offers every place', () => {
    render(<TopNav items={items} selectedId="home" onSelect={vi.fn()} />)

    for (const item of items) {
      expect(screen.getAllByRole('button', { name: item.label }).length).toBeGreaterThan(0)
    }
  })

  it('says which place is being stood on', () => {
    render(<TopNav items={items} selectedId="shows" onSelect={vi.fn()} />)

    const [shows] = screen.getAllByRole('button', { name: 'Shows' })

    expect(shows).toHaveAttribute('aria-current', 'page')
  })

  it('writes out the name of the place being stood on, and only that one', () => {
    render(<TopNav items={items} selectedId="shows" onSelect={vi.fn()} />)

    // The others are their icons alone until they are stood on. Their names
    // are still said to a screen reader, which is what the labels are for.
    expect(screen.getByText('Shows')).toBeInTheDocument()
    expect(screen.queryByText('Films')).not.toBeInTheDocument()
  })

  it('goes where it is asked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<TopNav items={items} selectedId="home" onSelect={onSelect} />)
    await user.click(screen.getAllByRole('button', { name: 'Films' })[0] ?? document.body)

    expect(onSelect).toHaveBeenCalledWith('films')
  })

  it('draws the tools it is given', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
      <TopNav
        items={items}
        selectedId="home"
        onSelect={vi.fn()}
        actions={[{ id: 'search', label: 'Search', icon: <span />, onSelect }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onSelect).toHaveBeenCalled()
  })

  it('draws a tool that owns its own control as given', () => {
    render(
      <TopNav
        items={items}
        selectedId="home"
        onSelect={vi.fn()}
        actions={[
          {
            id: 'notifications',
            label: 'Notifications',
            icon: null,
            control: <button type="button">Its own</button>,
            onSelect: vi.fn(),
          },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Its own' })).toBeInTheDocument()
  })

  it('folds the places behind one control for a narrow screen', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<TopNav items={items} selectedId="home" onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Where to go' }))

    const menu = await screen.findByRole('dialog')

    await user.click(within(menu).getByRole('button', { name: 'Films' }))

    expect(onSelect).toHaveBeenCalledWith('films')
  })

  it('shows the mark, where it is given one', () => {
    render(<TopNav items={items} selectedId="home" onSelect={vi.fn()} brand={<span>Flux</span>} />)

    expect(screen.getByText('Flux')).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(TopNav.displayName).toBe('TopNav')
  })
})
