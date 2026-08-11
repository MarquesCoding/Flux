import { z } from 'zod'

/**
 * What makes a job run on its own, without an admin pressing Run.
 *
 * A job holds a list of these rather than one cadence, matching how Jellyfin
 * models a scheduled task: "nightly, and again whenever the server comes up"
 * is two triggers, not a single setting that has to somehow mean both.
 *
 * Not free-form cron — an operator does not think in cron, and a picker
 * offering raw cron syntax is easy to misconfigure. Every timed variant maps
 * onto cron exactly; `startup` deliberately does not, and the server fires it
 * itself at boot instead.
 */
const ScheduleTriggerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('startup') }),
  z.object({
    kind: z.literal('everyMinutes'),
    /**
     * Bounded to what a cron minute-step field can express — 60 or more
     * would just be a whole number of hours, which `everyHours` already says
     * more plainly.
     */
    minutes: z.number().int().min(1).max(59),
  }),
  z.object({
    kind: z.literal('everyHours'),
    /**
     * Bounded the same way `minutes` is — 24 or more is a whole number of
     * days, which `daily`/`weekly` already say more plainly.
     */
    hours: z.number().int().min(1).max(23),
  }),
  z.object({
    kind: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    kind: z.literal('weekly'),
    /**
     * 0 is Sunday, matching cron's own day-of-week field.
     */
    dayOfWeek: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
])

type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>

/**
 * Writes a trigger as the cron expression pg-boss schedules on.
 *
 * Null for `startup`: there is no time of day to schedule, because the server
 * runs it when it comes up — see `JobScheduleService.sync`.
 */
const toCron = (trigger: ScheduleTrigger): string | null => {
  switch (trigger.kind) {
    case 'startup':
      return null
    case 'everyMinutes':
      return `*/${trigger.minutes.toString()} * * * *`
    case 'everyHours':
      return `0 */${trigger.hours.toString()} * * *`
    case 'daily':
      return `${trigger.minute.toString()} ${trigger.hour.toString()} * * *`
    case 'weekly':
      return `${trigger.minute.toString()} ${trigger.hour.toString()} * * ${trigger.dayOfWeek.toString()}`
  }
}

export type { ScheduleTrigger }

export default { ScheduleTriggerSchema, toCron }
