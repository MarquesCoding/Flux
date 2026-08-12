import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

type BackgroundJobsProps = {
  monitor: Monitor | null;
  isUnreachable?: boolean;
  /**
   * How many rows arrive at a time as it is scrolled. The overview holds fewer
   * than the jobs section, because it is a glance rather than a place to work.
   */
  pageSize?: number;
};

export type { BackgroundJobsProps };
