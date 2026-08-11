import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('formats a duration under a minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('formats a duration under an hour without an hour component', () => {
    expect(formatDuration(605)).toBe('10:05')
  })

  it('formats a duration over an hour', () => {
    expect(formatDuration(7325)).toBe('2:02:05')
  })

  it('pads minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('truncates fractional seconds', () => {
    expect(formatDuration(59.9)).toBe('0:59')
  })

  it('treats negative input as zero', () => {
    expect(formatDuration(-10)).toBe('0:00')
  })

  it('treats non-finite input as zero', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})
