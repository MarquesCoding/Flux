import type { ScheduleTrigger } from './scheduleTrigger'

/**
 * One stored trigger, and the id that removing it names.
 */
type StoredTrigger = {
  id: string
  kind: string
  trigger: ScheduleTrigger
}

/**
 * Where a job's triggers are kept.
 *
 * A store beneath `JobScheduleService` rather than part of it, so the service
 * — which is where the reconciling against pg-boss lives — can be tested
 * without Postgres, the same way `MediaStore` sits beneath the scanner.
 */
type JobTriggerStore = {
  /**
   * Every trigger for every kind, oldest first.
   */
  list: () => Promise<StoredTrigger[]>
  add: (kind: string, trigger: ScheduleTrigger) => Promise<StoredTrigger>
  /**
   * Removes one trigger. False means there was no such trigger on that kind.
   */
  remove: (kind: string, triggerId: string) => Promise<boolean>
}

export type { JobTriggerStore, StoredTrigger }
