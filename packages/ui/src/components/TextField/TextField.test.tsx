import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TextField } from './TextField'

const Harness = ({ label = 'Email' }: { label?: string }) => {
  const [value, setValue] = useState('')

  return <TextField label={label} value={value} onValueChange={setValue} />
}

describe('TextField', () => {
  it('associates its label with the input', () => {
    render(<TextField label="Email" value="" onValueChange={vi.fn()} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('reports each typed character', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<TextField label="Email" value="" onValueChange={onValueChange} />)

    await user.type(screen.getByLabelText('Email'), 'a')

    expect(onValueChange).toHaveBeenCalledWith('a')
  })

  it('accumulates typed text when driven by state', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Email'), 'flux')

    expect(screen.getByLabelText('Email')).toHaveValue('flux')
  })

  it('renders a description linked to the input', () => {
    render(
      <TextField
        label="Origin"
        value=""
        onValueChange={vi.fn()}
        description="The URL you reach this server on"
      />,
    )

    expect(screen.getByLabelText('Origin')).toHaveAccessibleDescription(
      'The URL you reach this server on',
    )
  })

  it('marks itself invalid and announces the error', () => {
    render(
      <TextField label="Email" value="nope" onValueChange={vi.fn()} error="Enter a valid email" />,
    )

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email')
  })

  it('is not invalid when no error is given', () => {
    render(<TextField label="Email" value="" onValueChange={vi.fn()} />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('masks a password field', () => {
    render(<TextField label="Password" value="" onValueChange={vi.fn()} type="password" />)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('does not accept input when disabled', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<TextField label="Email" value="" onValueChange={onValueChange} disabled />)

    await user.type(screen.getByLabelText('Email'), 'a')

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(TextField.displayName).toBe('TextField')
  })
})
