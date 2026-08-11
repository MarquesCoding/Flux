import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '')).toBe('a')
  })

  it('lets a later conflicting tailwind utility win', () => {
    expect(cn('bg-accent', 'bg-danger')).toBe('bg-danger')
  })

  it('keeps non-conflicting utilities', () => {
    expect(cn('px-4', 'text-sm')).toBe('px-4 text-sm')
  })

  it('returns an empty string when given nothing', () => {
    expect(cn()).toBe('')
  })
})
