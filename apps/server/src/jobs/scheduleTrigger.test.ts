import { describe, expect, it } from 'vitest';
import { ScheduleTriggerSchema, toCron } from './scheduleTrigger';
describe('scheduleTrigger', () => {
  it('writes a minute step as a cron minute field', () => {
    expect(toCron({ kind: 'everyMinutes', minutes: 15 })).toBe('*/15 * * * *');
  });

  it('writes an hour step on the hour', () => {
    expect(toCron({ kind: 'everyHours', hours: 6 })).toBe('0 */6 * * *');
  });

  it('writes a daily trigger at its time of day', () => {
    expect(toCron({ kind: 'daily', hour: 3, minute: 30 })).toBe('30 3 * * *');
  });

  it('writes a weekly trigger on its day', () => {
    expect(toCron({ kind: 'weekly', dayOfWeek: 0, hour: 2, minute: 0 })).toBe('0 2 * * 0');
  });

  it('has no cron for a startup trigger, which the server fires itself', () => {
    expect(toCron({ kind: 'startup' })).toBeNull();
  });

  it('rejects a minute step cron cannot express', () => {
    expect(ScheduleTriggerSchema.safeParse({ kind: 'everyMinutes', minutes: 60 }).success).toBe(
      false,
    );
  });

  it('rejects an hour step cron cannot express', () => {
    expect(ScheduleTriggerSchema.safeParse({ kind: 'everyHours', hours: 24 }).success).toBe(false);
  });

  it('rejects a day of week outside a real week', () => {
    expect(
      ScheduleTriggerSchema.safeParse({ kind: 'weekly', dayOfWeek: 7, hour: 0, minute: 0 }).success,
    ).toBe(false);
  });

  it('accepts a startup trigger carrying nothing else', () => {
    expect(ScheduleTriggerSchema.safeParse({ kind: 'startup' }).success).toBe(true);
  });
});
