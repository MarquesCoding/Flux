import { describe, expect, it } from 'vitest'
import { shiftWebVtt, readTimestamp, writeTimestamp } from './shiftWebVtt'

const FILE = [
  'WEBVTT',
  '',
  '1',
  '00:00:10.000 --> 00:00:12.000',
  'Early line',
  '',
  '2',
  '00:40:05.500 --> 00:40:08.000',
  'Later line',
  '',
].join('\n')

describe('readTimestamp', () => {
  it('reads hours, minutes and seconds', () => {
    expect(readTimestamp('01:02:03.500')).toBeCloseTo(3723.5)
  })

  it('reads a stamp written without hours', () => {
    expect(readTimestamp('02:03.250')).toBeCloseTo(123.25)
  })
})

describe('writeTimestamp', () => {
  it('always writes hours, so a cue crossing the hour does not change shape', () => {
    expect(writeTimestamp(59)).toBe('00:00:59.000')
    expect(writeTimestamp(3601.5)).toBe('01:00:01.500')
  })

  it('pads the seconds so the field is a fixed width', () => {
    expect(writeTimestamp(61.25)).toBe('00:01:01.250')
  })

  it('never writes a negative time', () => {
    expect(writeTimestamp(-30)).toBe('00:00:00.000')
  })
})

describe('shiftWebVtt', () => {
  it('leaves a file alone when there is nothing to shift', () => {
    expect(shiftWebVtt(FILE, 0)).toBe(FILE)
  })

  it('moves cues back by the amount the stream starts in', () => {
    const shifted = shiftWebVtt(FILE, 2400)

    expect(shifted).toContain('00:00:05.500 --> 00:00:08.000')
  })

  it('drops a cue that would land before the stream begins', () => {
    const shifted = shiftWebVtt(FILE, 2400)

    expect(shifted).not.toContain('Early line')
    expect(shifted).toContain('Later line')
  })

  it('keeps the header', () => {
    expect(shiftWebVtt(FILE, 2400).startsWith('WEBVTT')).toBe(true)
  })

  it('does not leave the blank line a dropped cue was preceded by', () => {
    expect(shiftWebVtt(FILE, 2400)).not.toContain('\n\n\n')
  })

  it('keeps whatever settings followed the timing', () => {
    const withSettings = '00:00:20.000 --> 00:00:22.000 line:62% align:center\nA line'

    expect(shiftWebVtt(withSettings, 10)).toContain('line:62% align:center')
  })

  it('reads a timing written without hours', () => {
    expect(shiftWebVtt('00:30.000 --> 00:35.000\nA line', 10)).toContain(
      '00:00:20.000 --> 00:00:25.000',
    )
  })

  it('drops the text belonging to a dropped cue, not only its timing', () => {
    const two = [
      '00:00:01.000 --> 00:00:02.000',
      'Gone',
      '',
      '00:01:00.000 --> 00:01:02.000',
      'Kept',
    ].join('\n')

    expect(shiftWebVtt(two, 30)).toBe('00:00:30.000 --> 00:00:32.000\nKept')
  })

  it('shifts a cue forwards when the stream starts before the file does', () => {
    expect(shiftWebVtt('00:00:10.000 --> 00:00:12.000\nA line', -5)).toContain(
      '00:00:15.000 --> 00:00:17.000',
    )
  })
})
