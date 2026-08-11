import { describe, expect, it } from 'vitest'
import {
  WatchProgressSchema,
  WatchProgressListSchema,
  isWorthResuming,
  watchedFraction,
  STARTED_AFTER_SECONDS,
  FINISHED_WITHIN_SECONDS,
} from './WatchProgress'
import type { WatchProgress } from './WatchProgress'

const progressOf = (changes: Partial<WatchProgress> = {}): WatchProgress => ({
  mediaId: '0a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d',
  positionSeconds: 600,
  durationSeconds: 7200,
  isFinished: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...changes,
})

describe('WatchProgressSchema', () => {
  it('accepts a position somebody has actually reached', () => {
    expect(WatchProgressSchema.safeParse(progressOf()).success).toBe(true)
  })

  it('refuses a position before the beginning', () => {
    expect(WatchProgressSchema.safeParse(progressOf({ positionSeconds: -1 })).success).toBe(false)
  })

  it('refuses an item with no length, which nothing can be a fraction of', () => {
    expect(WatchProgressSchema.safeParse(progressOf({ durationSeconds: 0 })).success).toBe(false)
  })

  it('refuses an identifier that is not one', () => {
    expect(WatchProgressSchema.safeParse(progressOf({ mediaId: 'the-film' })).success).toBe(false)
  })
})

describe('WatchProgressListSchema', () => {
  it('reads a list of positions', () => {
    const parsed = WatchProgressListSchema.safeParse({ progress: [progressOf()] })

    expect(parsed.success).toBe(true)
  })

  it('reads an empty list, which is what a new viewer has', () => {
    expect(WatchProgressListSchema.safeParse({ progress: [] }).success).toBe(true)
  })
})

describe('isWorthResuming', () => {
  it('offers to resume something somebody is partway through', () => {
    expect(isWorthResuming(progressOf())).toBe(true)
  })

  it('does not offer to resume something barely started', () => {
    expect(isWorthResuming(progressOf({ positionSeconds: STARTED_AFTER_SECONDS - 1 }))).toBe(false)
  })

  it('does not offer to resume the credits', () => {
    expect(
      isWorthResuming(progressOf({ positionSeconds: 7200 - FINISHED_WITHIN_SECONDS + 1 })),
    ).toBe(false)
  })

  it('does not offer to resume something already finished', () => {
    expect(isWorthResuming(progressOf({ isFinished: true }))).toBe(false)
  })
})

describe('watchedFraction', () => {
  it('says how far through something is', () => {
    expect(watchedFraction(progressOf({ positionSeconds: 1800 }))).toBeCloseTo(0.25)
  })

  it('never says more than all of it, however far past the end a position is', () => {
    expect(watchedFraction(progressOf({ positionSeconds: 9000 }))).toBe(1)
  })

  it('says nothing has been watched of something with no length', () => {
    expect(watchedFraction({ ...progressOf(), durationSeconds: 0 })).toBe(0)
  })
})
