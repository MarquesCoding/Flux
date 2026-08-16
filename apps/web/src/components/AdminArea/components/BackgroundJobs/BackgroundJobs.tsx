import { useMemo, useRef } from 'react';
import { Badge } from '@FluxUI/Badge';
import { DataTable } from '@FluxUI/DataTable';
import { describeElapsed } from '@FluxWeb/components/AdminArea/describeElapsed';
import { describeQueueKind } from '@FluxWeb/components/AdminArea/describeQueueKind';
import type { DataTableColumn } from '@FluxUI/DataTable.types';
import type { Job } from '@FluxWeb/admin/fetchAdmin';
import type { BackgroundJobsProps } from './BackgroundJobs.types';

/**
 * Sums up what the queue is doing in one line, so the heading says whether anything is happening
 * before anybody reads the table under it.
 *
 * @param monitor - The latest readings, or null before any have arrived.
 * @returns The line to show.
 */
const describeQueue = (jobs: Job[]): string =>
  jobs
    .map(
      (job) =>
        `${job.id}:${job.state}:${String(job.startedAtMs)}:${String(job.finishedAtMs)}:${job.detail ?? ''}`,
    )
    .join('|');

const NOTHING_QUEUED: Job[] = [];

const JOB_TONES: Record<Job['state'], 'quiet' | 'accent' | 'solid'> = {
  queued: 'quiet',
  running: 'accent',
  finished: 'quiet',
  failed: 'solid',
};

/**
 * What the queue has been doing, as one paged table: what ran, how it ended, how long it took, and
 * what went wrong where something did. This is the record rather than the controls — starting and
 * stopping work lives with the jobs themselves.
 *
 * @param monitor - The latest readings, or null before any have arrived.
 * @param isUnreachable - Whether the service is not answering, which is why the table is empty.
 * @param pageSize - How many rows to show at once.
 */
const BackgroundJobs = ({ monitor, isUnreachable = false, pageSize }: BackgroundJobsProps) => {
  const arrived = monitor?.queue.jobs ?? NOTHING_QUEUED;
  const saying = describeQueue(arrived);
  const held = useRef(arrived);
  const saidRef = useRef(saying);

  if (saidRef.current !== saying) {
    held.current = arrived;
    saidRef.current = saying;
  }

  const rows = held.current;

  const columns = useMemo<DataTableColumn<Job>[]>(
    () => [
      {
        id: 'state',
        header: 'State',
        accessorFn: (job) => job.state,
        cell: ({ row }) => (
          <Badge size="sm" tone={JOB_TONES[row.original.state]}>
            {row.original.state}
          </Badge>
        ),
      },
      {
        id: 'kind',
        header: 'Job',
        accessorFn: (job) => describeQueueKind(job.kind),
        cell: ({ row }) => (
          <span className="text-text-muted">{describeQueueKind(row.original.kind)}</span>
        ),
      },
      {
        id: 'subject',
        header: 'Subject',
        accessorFn: (job) => job.subject,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-text" title={row.original.subject}>
              {row.original.subject}
            </span>

            {row.original.detail === null ? null : (
              <span className="truncate text-xs text-danger">{row.original.detail}</span>
            )}
          </span>
        ),
      },
      {
        id: 'finished',
        header: 'Finished',
        accessorFn: (job) => job.finishedAtMs ?? 0,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-text-muted">
            {row.original.finishedAtMs === null
              ? row.original.startedAtMs === null
                ? 'waiting'
                : 'running'
              : new Date(row.original.finishedAtMs).toLocaleTimeString()}
          </span>
        ),
      },
      {
        id: 'took',
        header: 'Took',
        accessorFn: (job) => (job.finishedAtMs ?? Date.now()) - (job.startedAtMs ?? Date.now()),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-text-muted">
            {describeElapsed(row.original, Date.now())}
          </span>
        ),
      },
    ],
    [],
  );

  if (isUnreachable) {
    return (
      <p className="p-6 text-sm text-text-muted">The queue could not be read from the server.</p>
    );
  }

  return (
    <DataTable
      label="Background jobs"
      columns={columns}
      rows={rows}
      emptyMessage="Nothing queued."
      growsOnScroll
      {...(pageSize === undefined ? {} : { pageSize })}
    />
  );
};

BackgroundJobs.displayName = 'BackgroundJobs';

export { BackgroundJobs };
