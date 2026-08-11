import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ButtonModule from './Button'

const { Button } = ButtonModule

describe('Button', () => {
  it('renders its children as an accessible button', () => {
    render(<Button>Play</Button>)

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('defaults to type button so it never submits a form implicitly', () => {
    render(<Button>Play</Button>)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Play</Button>)

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button disabled onClick={onClick}>
        Play
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('marks itself busy and disabled while loading', () => {
    render(<Button isLoading>Play</Button>)

    const button = screen.getByRole('button', { name: /Play/ })

    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })

  it('shows a spinner while loading', () => {
    render(<Button isLoading>Play</Button>)

    expect(screen.getByRole('status', { name: 'Working' })).toBeInTheDocument()
  })

  it('shows no spinner when not loading', () => {
    render(<Button>Play</Button>)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('lets a caller class override a variant default', () => {
    render(<Button className="bg-danger">Play</Button>)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('bg-danger')
  })

  it('sets a display name so devtools can identify it', () => {
    expect(Button.displayName).toBe('Button')
  })

  it('offers a glossy treatment for the controls that matter most', () => {
    render(<Button variant="glossy">Play</Button>)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('flux-gloss')
  })

  it('rounds fully when asked for a pill', () => {
    render(<Button isPill>Play</Button>)

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('rounded-full')
  })

  it('is a rounded box otherwise', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('rounded-lg')
  })

  it('offers a size for a hero control', () => {
    render(
      <Button size="xl" variant="glossy">
        Watch now
      </Button>,
    )

    expect(screen.getByRole('button', { name: 'Watch now' })).toHaveClass('h-14')
  })
})
