import { JOB_DEFINITIONS, scheduleQueueNameFor } from './jobDefinitions';

/**
 * Whether a job finishing is worth telling anybody about.
 *
 * Three kinds of job are not. Upkeep — the checking and tidying a server does to itself — finishes
 * constantly: the transcoder check runs every five minutes and the disk check every fifteen, so
 * announcing each success buries the things somebody wanted told. A scan has an event of its own,
 * `library.scanned`, which says what it found and covers every library scanned together rather than
 * one message per library. And a queue the job catalogue has never heard of is internal machinery,
 * which would announce itself under its own queue name; nobody wants to read `library.readAgain
 * finished`.
 *
 * This governs finishing only. Anything failing is still announced, whatever it is — a check that
 * cannot run is exactly the thing a check exists to report.
 *
 * @param kind - The queue the job ran on.
 * @returns Whether finishing it should be published.
 */
const announcesCompletion = (kind: string): boolean => {
  const definition = JOB_DEFINITIONS.find(
    (candidate) => candidate.kind === kind || scheduleQueueNameFor(candidate.kind) === kind,
  );

  return definition?.announcesFinish === true;
};

export { announcesCompletion };
