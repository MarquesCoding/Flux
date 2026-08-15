import type { ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Writes an hour and minute as a 24-hour clock time.
 */
const toClock = (hour: number, minute: number): string =>
  `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

/**
 * Says what a trigger does, in the words an operator would use.
 */
const describeTrigger = (trigger: ScheduleTrigger): string => {
  switch (trigger.kind) {
    case 'startup':
      return 'On application startup';
    case 'everyMinutes':
      return trigger.minutes === 1 ? 'Every minute' : `Every ${trigger.minutes.toString()} minutes`;
    case 'everyHours':
      return trigger.hours === 1 ? 'Every hour' : `Every ${trigger.hours.toString()} hours`;
    case 'daily':
      return `Daily at ${toClock(trigger.hour, trigger.minute)}`;
    case 'weekly':
      return `${DAY_NAMES[trigger.dayOfWeek] ?? 'Weekly'} at ${toClock(trigger.hour, trigger.minute)}`;
  }
};

export { describeTrigger, DAY_NAMES, toClock };
