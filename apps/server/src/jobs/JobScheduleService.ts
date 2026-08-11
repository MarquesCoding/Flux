import type { ScheduleTrigger } from './scheduleTrigger'

/**
 * One trigger on a job, and the id that removing it names.
 */
type JobTrigger = {
  id: string
  trigger: ScheduleTrigger
}

type JobSchedule = {
  kind: string
  /**
   * Every trigger set on this job, oldest first. Empty means it only ever
   * runs when an admin presses Run.
   */
  triggers: JobTrigger[]
}

/**
 * What makes each job run on its own, as the HTTP layer sees it.
 *
 * A port rather than the raw `JobQueue`, so a route never has to know a
 * library-scoped kind's schedule actually fires on a different queue name —
 * see `scheduleQueueNameFor` — that a trigger is stored as cron at all, or
 * that a startup trigger is not stored in the queue whatsoever.
 */
type JobScheduleService = {
  /**
   * Every job kind and its triggers, including the kinds with none.
   */
  list: () => Promise<JobSchedule[]>
  /**
   * Adds one trigger to a job.
   *
   * Null means no such kind — every schedulable kind belongs to
   * `JOB_DEFINITIONS`, so this can only happen for a kind the picker never
   * offered.
   */
  add: (kind: string, trigger: ScheduleTrigger) => Promise<JobTrigger | null>
  /**
   * Removes one trigger. False means there was no such trigger on that kind.
   */
  remove: (kind: string, triggerId: string) => Promise<boolean>
  /**
   * Re-applies every stored trigger to the queue, reporting the kinds that
   * run on startup.
   *
   * Called once as the server comes up: the queue's own schedule rows may be
   * stale or missing — a database restored from backup, a trigger added
   * while this process was down — and the caller runs the kinds it reports
   * itself, since a startup trigger is not something a queue can fire.
   */
  sync: () => Promise<string[]>
}

export type { JobSchedule, JobScheduleService, JobTrigger }
