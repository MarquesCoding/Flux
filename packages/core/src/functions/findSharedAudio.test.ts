import { describe, expect, it } from 'vitest'
import findSharedAudioModule from './findSharedAudio'
import type { Range } from './findSharedAudio'

const { findSharedAudio, agreeRange, bitsDiffering, overlaps } = findSharedAudioModule

const FPS = 10

/**
 * A run of frames that no other run will match by accident.
 *
 * Deliberately decorrelated: hashes that merely count upwards differ from
 * their neighbours in the low bits alone, so any two stretches of them match
 * within a few bits and every comparison finds a run that is not there.
 */
const distinct = (seed: number, count: number): number[] => {
  let state = (seed * 0x9e3779b9) >>> 0

  return Array.from({ length: count }, () => {
    state = (state + 0x6d2b79f5) >>> 0

    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1) >>> 0
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return (value ^ (value >>> 14)) >>> 0
  })
}

const options = { framesPerSecond: FPS, minSeconds: 2, toleratedGapSeconds: 0.5 }

describe('bitsDiffering', () => {
  it('reports nothing for identical hashes', () => {
    expect(bitsDiffering(0b1010, 0b1010)).toBe(0)
  })

  it('counts each differing bit', () => {
    expect(bitsDiffering(0b1010, 0b0001)).toBe(3)
  })

  it('counts across the whole width, including the top bit', () => {
    expect(bitsDiffering(0, 0xffffffff)).toBe(32)
  })
})

describe('findSharedAudio', () => {
  it('finds a run two recordings share', () => {
    const theme = distinct(1, 100)
    const left = [...distinct(2, 50), ...theme, ...distinct(3, 50)]
    const right = [...distinct(4, 20), ...theme, ...distinct(5, 80)]

    const found = findSharedAudio(left, right, options)

    expect(found?.left.startSeconds).toBeCloseTo(5, 1)
    expect(found?.right.startSeconds).toBeCloseTo(2, 1)
    expect(found?.frames).toBe(100)
  })

  it('finds the run wherever it sits, since episodes open differently', () => {
    const theme = distinct(1, 80)
    const left = [...theme, ...distinct(2, 100)]
    const right = [...distinct(3, 120), ...theme]

    const found = findSharedAudio(left, right, options)

    expect(found?.left.startSeconds).toBeCloseTo(0, 1)
    expect(found?.right.startSeconds).toBeCloseTo(12, 1)
  })

  it('reports nothing when two recordings share nothing', () => {
    expect(findSharedAudio(distinct(1, 200), distinct(2, 200), options)).toBeNull()
  })

  it('ignores a match too short to be a theme tune', () => {
    const snippet = distinct(1, 5)
    const left = [...distinct(2, 50), ...snippet]
    const right = [...distinct(3, 50), ...snippet]

    expect(findSharedAudio(left, right, options)).toBeNull()
  })

  it('survives a re-encode, where a few bits differ in every frame', () => {
    const theme = distinct(1, 100)
    const reencoded = theme.map((hash) => hash ^ 0b101)
    const left = [...distinct(2, 30), ...theme]
    const right = [...distinct(3, 10), ...reencoded]

    expect(findSharedAudio(left, right, options)?.frames).toBe(100)
  })

  it('refuses a match where too many bits differ to be the same audio', () => {
    const theme = distinct(1, 100)
    const mangled = theme.map((hash) => hash ^ 0xffff)

    expect(findSharedAudio(theme, mangled, options)).toBeNull()
  })

  it('holds a run together across a brief interruption', () => {
    const theme = distinct(1, 100)
    // A title card spoken over the theme: three frames of something else.
    const interrupted = [...theme]
    interrupted.splice(50, 3, ...distinct(9, 3))

    const found = findSharedAudio(theme, interrupted, options)

    expect(found?.frames).toBeGreaterThan(90)
  })

  it('reports nothing for an empty fingerprint', () => {
    expect(findSharedAudio([], distinct(1, 100), options)).toBeNull()
    expect(findSharedAudio(distinct(1, 100), [], options)).toBeNull()
  })

  it('reports nothing rather than dividing by a frame rate of zero', () => {
    expect(findSharedAudio(distinct(1, 100), distinct(1, 100), { framesPerSecond: 0 })).toBeNull()
  })

  it('turns frame counts into seconds using the rate it was given', () => {
    const theme = distinct(1, 60)
    const found = findSharedAudio(theme, theme, { ...options, framesPerSecond: 20 })

    expect(found?.left.endSeconds).toBeCloseTo(3, 1)
  })
})

describe('overlaps', () => {
  const range = (startSeconds: number, endSeconds: number): Range => ({ startSeconds, endSeconds })

  it('accepts two measurements of the same stretch', () => {
    expect(overlaps(range(10, 90), range(11, 89), 4)).toBe(true)
  })

  it('rejects two stretches that merely touch', () => {
    expect(overlaps(range(10, 90), range(80, 160), 4)).toBe(false)
  })
})

describe('agreeRange', () => {
  const range = (startSeconds: number, endSeconds: number): Range => ({ startSeconds, endSeconds })

  it('settles on the range most comparisons found', () => {
    const agreed = agreeRange([range(10, 90), range(11, 91), range(9, 89), range(400, 480)])

    expect(agreed?.startSeconds).toBeCloseTo(10, 1)
    expect(agreed?.endSeconds).toBeCloseTo(90, 1)
  })

  it('takes the middle measurement rather than any single one', () => {
    const agreed = agreeRange([range(10, 90), range(12, 92), range(14, 94)])

    expect(agreed?.startSeconds).toBe(12)
  })

  it('reports nothing when there is nothing to agree about', () => {
    expect(agreeRange([])).toBeNull()
  })

  it('answers with the one measurement it has', () => {
    expect(agreeRange([range(10, 90)])).toMatchObject({ startSeconds: 10, endSeconds: 90 })
  })

  it('still finds the run when the sequences are too long to try every alignment', () => {
    // Past the exhaustive limit, alignments are proposed rather than swept.
    const theme = distinct(1, 900)
    const left = [...distinct(2, 400), ...theme, ...distinct(3, 1500)]
    const right = [...distinct(4, 900), ...theme, ...distinct(5, 1000)]

    const found = findSharedAudio(left, right, { framesPerSecond: FPS, minSeconds: 2 })

    expect(found?.frames).toBeGreaterThan(800)
    expect(found?.left.startSeconds).toBeCloseTo(40, 0)
    expect(found?.right.startSeconds).toBeCloseTo(90, 0)
  })

  it('finishes a season sized comparison in a reasonable time', () => {
    const theme = distinct(1, 940)
    const left = [...distinct(2, 300), ...theme, ...distinct(3, 8000)]
    const right = [...distinct(4, 700), ...theme, ...distinct(5, 8000)]

    const started = performance.now()

    findSharedAudio(left, right, { framesPerSecond: FPS, minSeconds: 15 })

    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('reports nothing rather than inventing a run when long sequences share nothing', () => {
    const left = distinct(2, 6000)
    const right = distinct(3, 6000)

    expect(findSharedAudio(left, right, { framesPerSecond: FPS, minSeconds: 15 })).toBeNull()
  })
})
