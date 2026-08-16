import { z } from 'zod';

const ScheduleTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('startup') }),
  z.object({
    kind: z.literal('everyMinutes'),
    minutes: z.number().int().min(1).max(59),
  }),
  z.object({
    kind: z.literal('everyHours'),
    hours: z.number().int().min(1).max(23),
  }),
  z.object({
    kind: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('weekly'),
    dayOfWeek: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
]);

type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>;

/**
 * Writes a trigger as the cron expression the queue schedules on, from the shape an operator
 * configured — every so many hours, daily at a time, weekly on a day.
 *
 * @param trigger - The schedule as an operator set it.
 * @returns The cron expression, or null for a trigger that fires on an event rather than a clock.
 */
const toCron = (trigger: ScheduleTrigger): string | null => {
  switch (trigger.kind) {
    case 'startup':
      return null;
    case 'everyMinutes':
      return `*/${trigger.minutes.toString()} * * * *`;
    case 'everyHours':
      return `0 */${trigger.hours.toString()} * * *`;
    case 'daily':
      return `${trigger.minute.toString()} ${trigger.hour.toString()} * * *`;
    case 'weekly':
      return `${trigger.minute.toString()} ${trigger.hour.toString()} * * ${trigger.dayOfWeek.toString()}`;
  }
};

export type { ScheduleTrigger };

export { ScheduleTriggerSchema, toCron };
