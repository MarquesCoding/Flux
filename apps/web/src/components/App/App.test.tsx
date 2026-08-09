import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import AppModule from './App'

const { App } = AppModule

describe('App', () => {
  it('renders the default title', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Flux' })).toBeInTheDocument()
  })

  it('renders a supplied title', () => {
    render(<App initialTitle="Living Room" />)

    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
  })

  it('formats the sample runtime with the shared core function', () => {
    render(<App />)

    expect(screen.getByText('Sample runtime 2:02:05')).toBeInTheDocument()
  })

  it('puts the play button into a loading state when pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Play/ }))

    expect(screen.getByRole('button', { name: /Play/ })).toHaveAttribute('aria-busy', 'true')
  })

  it('clears the loading state when reset', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Play/ }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-busy', 'false')
  })

  it('renders the subtitle checkbox', () => {
    render(<App />)

    expect(screen.getByRole('checkbox', { name: 'Burn in subtitles' })).toBeInTheDocument()
  })
})
