import { describe, expect, it } from 'vitest'
import formatBytesModule from './formatBytes'

const { formatBytes } = formatBytesModule

describe('formatBytes', () => {
  it('says bytes as bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('climbs to the unit that reads as a small number', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(3.4 * 1024 ** 3)).toBe('3.4 GB')
  })

  it('drops the decimal once the number is large enough not to need it', () => {
    expect(formatBytes(42 * 1024 ** 2)).toBe('42 MB')
  })

  it('stops at terabytes rather than inventing a unit', () => {
    expect(formatBytes(5000 * 1024 ** 4)).toBe('5000 TB')
  })

  it('says nothing rather than nonsense for nothing', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('0 B')
  })

  it('says nothing rather than nonsense for a number that is not one', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('0 B')
  })
})
