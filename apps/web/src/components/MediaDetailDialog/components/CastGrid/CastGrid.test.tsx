import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CastGrid } from './CastGrid'

const members = Array.from({ length: 14 }, (_, at) => ({
  name: `Player ${(at + 1).toString()}`,
  role: `Part ${(at + 1).toString()}`,
  imageUrl: null,
}))

/**
 * jsdom lays nothing out, so how wide the panel is has to be described. Six
 * faces at a hundred and seventy apiece, with the air between them.
 */
const widthOf = (width: number) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: width,
  })
}

describe('CastGrid', () => {
  it('shows as many faces as fit and no more', () => {
    widthOf(1100)
    render(<CastGrid members={members} />)

    expect(screen.getAllByText(/^Player /)).toHaveLength(6)
  })

  it('says how many there are in total, so a page reads as the top of a list', () => {
    widthOf(1100)
    render(<CastGrid members={members} />)

    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('turns to the rest a page at a time', async () => {
    const user = userEvent.setup()

    widthOf(1100)
    render(<CastGrid members={members} />)

    await user.click(screen.getByRole('button', { name: 'Show page 2' }))

    expect(screen.getByText('Player 7')).toBeInTheDocument()
    expect(screen.queryByText('Player 1')).not.toBeInTheDocument()
  })

  it('offers nowhere to turn when everybody already fits', () => {
    widthOf(1100)
    render(<CastGrid members={members.slice(0, 4)} />)

    expect(screen.queryByRole('button', { name: /Show page/ })).not.toBeInTheDocument()
  })

  it('puts three on a line where there is no room for six', () => {
    widthOf(320)
    render(<CastGrid members={members} />)

    expect(screen.getAllByText(/^Player /)).toHaveLength(3)
  })

  it('names each person and what they played', () => {
    widthOf(1100)
    render(<CastGrid members={members} />)

    expect(screen.getByText('Player 1')).toBeInTheDocument()
    expect(screen.getByText('Part 1')).toBeInTheDocument()
  })

  it('sets a display name so devtools can identify it', () => {
    expect(CastGrid.displayName).toBe('CastGrid')
  })
})
