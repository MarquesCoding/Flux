type ScheduleSendOptions = {
  key: string;
  tz: string;
  singletonKey: string;
};

/**
 * What a cron sends with every firing, which is where a schedule decides whether its ticks stack or
 * collapse into one another.
 *
 * The key is keyed on the queue rather than on the trigger, so two triggers an operator has set for
 * the same work — nightly and hourly, say — still leave one job waiting rather than two. A queue is
 * the work; a trigger is only an opinion about when to do it.
 *
 * The queue gives up a key once the job it belongs to starts, so one firing may wait behind work
 * already running while the rest collapse. That is deliberate: a rebuild outlasts the fifteen minute
 * scan several times over, and the schedule should survive it without arriving fifteen times.
 *
 * @param queueName - The queue the schedule fires on.
 * @param key - What the schedule is registered under, which is the trigger it came from.
 * @param timezone - The zone its cron is read in.
 * @returns The options to register the cron with.
 */
const scheduleSendOptions = (
  queueName: string,
  key: string,
  timezone: string,
): ScheduleSendOptions => ({
  key,
  tz: timezone,
  singletonKey: queueName,
});

export type { ScheduleSendOptions };

export { scheduleSendOptions };
