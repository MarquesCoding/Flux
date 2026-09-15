import { READ_AGAIN_JOB, SCAN_LIBRARY_JOB } from '@ValenceServer/jobs/JobQueue';

/**
 * Names the lock a piece of work takes out on a library.
 *
 * Reading and re-reading share one, because they are the two things that decide which items a
 * library has and two of them at once would fight over that. Everything else — clips, thumbnails,
 * lettering, intros — makes artefacts for items that already exist, works from what is outstanding
 * rather than from a list it was handed, and so has a lock of its own.
 *
 * It used to be the bare library id for all of them. That is what made a scan wait for the
 * thumbnails: not the job queue, which was happy to run both, but this lock inside the process.
 *
 * @param kind - The job asking.
 * @param libraryId - The library it is working on.
 * @returns The key to serialise it under.
 */
const lockFor = (kind: string, libraryId: string): string =>
  kind === SCAN_LIBRARY_JOB || kind === READ_AGAIN_JOB
    ? `reading:${libraryId}`
    : `${kind}:${libraryId}`;

export { lockFor };
