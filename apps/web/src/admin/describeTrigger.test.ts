import { describe, expect, it } from 'vitest'
import describeTriggerModule from './describeTrigger'

const { describeTrigger, toClock } = describeTriggerModule

describe('describeTrigger', () => {
  it('says when a job runs at startup', () => {
    expect(describeTrigger({ kind: 'startup' })).toBe('On application startup')
  })

  it('says a minute step in minutes', () => {
    expect(describeTrigger({ kind: 'everyMinutes', minutes: 15 })).toBe('Every 15 minutes')
  })

  it('drops the count when a step is one, rather than saying "every 1 minutes"', () => {
    expect(describeTrigger({ kind: 'everyMinutes', minutes: 1 })).toBe('Every minute')
    expect(describeTrigger({ kind: 'everyHours', hours: 1 })).toBe('Every hour')
  })

  it('says an hour step in hours', () => {
    expect(describeTrigger({ kind: 'everyHours', hours: 6 })).toBe('Every 6 hours')
  })

  it('says a daily trigger with its time', () => {
    expect(describeTrigger({ kind: 'daily', hour: 3, minute: 0 })).toBe('Daily at 03:00')
  })

  it('names the day a weekly trigger runs on', () => {
    expect(describeTrigger({ kind: 'weekly', dayOfWeek: 0, hour: 2, minute: 30 })).toBe(
      'Sunday at 02:30',
    )
    expect(describeTrigger({ kind: 'weekly', dayOfWeek: 6, hour: 23, minute: 5 })).toBe(
      'Saturday at 23:05',
    )
  })

  it('pads a clock time to two digits either side', () => {
    expect(toClock(9, 5)).toBe('09:05')
  })
})
