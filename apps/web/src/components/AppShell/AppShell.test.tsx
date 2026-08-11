import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppShellModule from './AppShell'
import type { AppShellProps } from './AppShell.types'

const { AppShell } = AppShellModule

const draw = (overrides: Partial<AppShellProps> = {}) => {
  const props: AppShellProps = {
    section: 'home',
    onSectionChange: vi.fn(),
    children: <p>The library</p>,
    ...overrides,
  }

  const view = render(<AppShell {...props} />)

  return { props, view }
}

describe('AppShell', () => {
  it('draws what it was given', () => {
    draw()

    expect(screen.getByText('The library')).toBeInTheDocument()
  })

  it('offers the few places worth going', () => {
    draw()

    for (const section of ['Home', 'Search', 'Account']) {
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
    draw({ section: 'search' })

    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between sections on request', async () => {
    const user = userEvent.setup()
    const { props } = draw()

    await user.click(screen.getByRole('button', { name: 'Account' }))

    expect(props.onSectionChange).toHaveBeenCalledWith('account')
  })

  it('lights the page with the colour of what is being shown', () => {
    const { view } = draw({ moodColor: '#5a3c8c' })

    // On the wash itself rather than the element positioning it: a custom
    // property is not something the animation library's style type carries.
    expect(
      view.container
        .querySelector<HTMLElement>('.flux-mood')
        ?.style.getPropertyValue('--color-mood'),
    ).toBe('#5a3c8c')
  })

  it('leaves room beneath the page for what floats over it', () => {
    const { view } = draw()

    expect(view.container.querySelector('main')).toHaveClass('pb-16')
  })

  it('has no rail down the side to collapse', () => {
    draw()

    expect(screen.queryByRole('button', { name: /sidebar/i })).not.toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(AppShell.displayName).toBe('AppShell')
  })
})
