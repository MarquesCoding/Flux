import { describe, expect, it } from 'vitest';
import { describeTriggerInZone } from './describeTriggerInZone';

const SUMMER = new Date('2026-08-17T12:00:00Z');

const WINTER = new Date('2026-01-15T12:00:00Z');

describe('describeTriggerInZone', () => {
  it('says nothing when the reader keeps the same clock as the server', () => {
    expect(
      describeTriggerInZone({
        trigger: { kind: 'daily', hour: 3, minute: 0 },
        serverZone: 'Europe/London',
        viewerZone: 'Europe/London',
        now: SUMMER,
      }),
    ).toBeNull();
  });

  it('says nothing for a trigger with no clock to convert', () => {
    for (const trigger of [
      { kind: 'startup' },
      { kind: 'everyHours', hours: 6 },
      { kind: 'everyMinutes', minutes: 30 },
    ] as const) {
      expect(
        describeTriggerInZone({
          trigger,
          serverZone: 'Europe/London',
          viewerZone: 'America/New_York',
          now: SUMMER,
        }),
      ).toBeNull();
    }
  });

  it('converts a daily time to the reader own clock', () => {
    expect(
      describeTriggerInZone({
        trigger: { kind: 'daily', hour: 3, minute: 0 },
        serverZone: 'Europe/London',
        viewerZone: 'America/New_York',
        now: SUMMER,
      }),
    ).toBe('22:00 your time');
  });

  it('names the day, because a weekly trigger can land on a different one', () => {
    expect(
      describeTriggerInZone({
        trigger: { kind: 'weekly', dayOfWeek: 0, hour: 2, minute: 0 },
        serverZone: 'Europe/London',
        viewerZone: 'America/New_York',
        now: SUMMER,
      }),
    ).toBe('Saturday at 21:00 your time');
  });

  it('keeps the day where it does not move', () => {
    expect(
      describeTriggerInZone({
        trigger: { kind: 'weekly', dayOfWeek: 0, hour: 6, minute: 0 },
        serverZone: 'Europe/London',
        viewerZone: 'America/New_York',
        now: SUMMER,
      }),
    ).toBe('Sunday at 01:00 your time');
  });

  it('reads the offset at the time of year it is asked about', () => {
    const summer = describeTriggerInZone({
      trigger: { kind: 'daily', hour: 12, minute: 0 },
      serverZone: 'Europe/London',
      viewerZone: 'UTC',
      now: SUMMER,
    });

    const winter = describeTriggerInZone({
      trigger: { kind: 'daily', hour: 12, minute: 0 },
      serverZone: 'Europe/London',
      viewerZone: 'UTC',
      now: WINTER,
    });

    expect(summer).toBe('11:00 your time');
    expect(winter).toBe('12:00 your time');
  });

  it('handles a zone with no daylight saving at all', () => {
    expect(
      describeTriggerInZone({
        trigger: { kind: 'daily', hour: 3, minute: 30 },
        serverZone: 'America/Phoenix',
        viewerZone: 'UTC',
        now: SUMMER,
      }),
    ).toBe('10:30 your time');
  });
});
