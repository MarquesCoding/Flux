import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppShellModule from './AppShell'
import type { AppShellProps } from './AppShell.types'

const { AppShell } = AppShellModule

const draw = (overrides: Partial<AppShellProps> = {}) => {
  const props: AppShellProps = {
    section: 'home',
    onSectionChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    account: <span>Signed in</span>,
    children: <p>The library</p>,
    ...overrides,
  }

  const view = render(<AppShell {...props} />)

  return { props, view }
}

afterEach(() => {
  window.localStorage.clear()
})

describe('AppShell', () => {
  it('draws what it was given', () => {
    draw()

    expect(screen.getByText('The library')).toBeInTheDocument()
    // Named distinctly from the Account section, which the sidebar also
    // carries: two things called the same thing is a test that proves nothing.
    expect(screen.getByText('Signed in')).toBeInTheDocument()
  })

  it('offers the sections a viewer can reach', () => {
    draw()

    for (const section of ['Home', 'Films', 'Series', 'Account']) {
      expect(screen.getByRole('button', { name: section })).toBeInTheDocument()
    }
  })

  it('hides administration from everyone who does not administer', () => {
    draw()

    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('offers administration to someone who does', () => {
    draw({ isAdministrator: true })

    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument()
  })

  it('says which section the viewer is in', () => {
    draw({ section: 'films' })

    expect(screen.getByRole('button', { name: 'Films' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between sections on request', async () => {
    const user = userEvent.setup()
    const { props } = draw()

    await user.click(screen.getByRole('button', { name: 'Series' }))

    expect(props.onSectionChange).toHaveBeenCalledWith('series')
  })

  it('reports what is being searched for', async () => {
    const user = userEvent.setup()
    const { props } = draw()

    await user.type(screen.getByRole('searchbox', { name: 'Search the library' }), 'a')

    expect(props.onSearchChange).toHaveBeenCalledWith('a')
  })

  it('offers to clear a search only once there is one', async () => {
    const user = userEvent.setup()
    const { props } = draw({ search: 'arrival' })

    expect(screen.getByRole('button', { name: 'Clear the search' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear the search' }))

    expect(props.onSearchChange).toHaveBeenCalledWith('')
  })

  it('offers nothing to clear when nothing is being searched for', () => {
    draw()

    expect(screen.queryByRole('button', { name: 'Clear the search' })).not.toBeInTheDocument()
  })

  it('lights the page with the colour of what is being shown', () => {
    draw({ moodColor: '#5a3c8c' })

    expect(screen.getByRole('presentation')).toHaveStyle({ '--color-mood': '#5a3c8c' })
  })

  it('collapses the sidebar on request', async () => {
    const user = userEvent.setup()
    draw()

    await user.click(screen.getByRole('button', { name: 'Collapse the sidebar' }))

    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument()
  })

  it('remembers a collapsed sidebar for next time', async () => {
    const user = userEvent.setup()
    const { view } = draw()

    await user.click(screen.getByRole('button', { name: 'Collapse the sidebar' }))

    view.unmount()
    draw()

    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument()
  })

  it('sets the bar on something once content has scrolled beneath it', () => {
    const { view } = draw()
    const scroller = view.container.querySelector('.overflow-y-auto')
    const bar = screen.getByRole('banner')

    expect(bar).not.toHaveClass('flux-glass')

    if (scroller !== null) {
      Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 200 })
      fireEvent.scroll(scroller)
    }

    expect(screen.getByRole('banner')).toHaveClass('flux-glass')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(AppShell.displayName).toBe('AppShell')
  })
})
