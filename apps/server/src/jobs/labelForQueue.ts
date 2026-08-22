import { JOB_DEFINITIONS, scheduleQueueNameFor } from './jobDefinitions';

/**
 * Names a queue the way an operator would say it, so that something wrong with a job reads as "Check
 * the transcoder" rather than as `server.checkTranscoder`. A library-scoped job fires its schedule on
 * a queue of its own, and both names answer to the same label.
 *
 * @param queueName - The queue the job ran on.
 * @returns What that work is called, or the queue's own name where nothing claims it.
 */
const labelForQueue = (queueName: string): string => {
  const definition = JOB_DEFINITIONS.find(
    (candidate) =>
      candidate.kind === queueName || scheduleQueueNameFor(candidate.kind) === queueName,
  );

  return definition?.label ?? queueName;
};

export { labelForQueue };
