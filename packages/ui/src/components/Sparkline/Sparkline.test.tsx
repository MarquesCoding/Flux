import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SparklineModule from './Sparkline'

const { Sparkline } = SparklineModule

const columnsOf = (): HTMLElement[] =>
  Array.from(screen.getByRole('img').children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )

describe('Sparkline', () => {
  it('says what the shape is of, since a drawing has no words', () => {
    render(<Sparkline values={[1, 2]} ceiling={4} label="CPU over the last minute" />)

    expect(screen.getByRole('img', { name: 'CPU over the last minute' })).toBeInTheDocument()
  })

  it('draws a column per reading', () => {
    render(<Sparkline values={[1, 2, 3]} ceiling={4} label="CPU" />)

    expect(columnsOf()).toHaveLength(3)
  })

  it('draws each reading against the ceiling', () => {
    render(<Sparkline values={[2]} ceiling={4} label="CPU" />)

    expect(columnsOf()[0]?.style.height).toBe('50%')
  })

  it('draws a reading at the ceiling as a full column', () => {
    render(<Sparkline values={[4]} ceiling={4} label="CPU" />)

    expect(columnsOf()[0]?.style.height).toBe('100%')
  })

  it('does not draw past the top when a reading overshoots', () => {
    render(<Sparkline values={[9]} ceiling={4} label="CPU" />)

    expect(columnsOf()[0]?.style.height).toBe('100%')
  })

  it('does not draw below the floor', () => {
    render(<Sparkline values={[-2]} ceiling={4} label="CPU" />)

    expect(columnsOf()[0]?.style.height).toBe('0%')
  })

  it('draws something rather than dividing by nothing when the ceiling is zero', () => {
    render(<Sparkline values={[1]} ceiling={0} label="CPU" />)

    expect(columnsOf()[0]?.style.height).toBe('100%')
  })

  it('draws nothing before there is any history', () => {
    render(<Sparkline values={[]} ceiling={4} label="CPU" />)

    expect(columnsOf()).toHaveLength(0)
  })
})
