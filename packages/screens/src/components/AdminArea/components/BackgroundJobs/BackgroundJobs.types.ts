import type { Monitor } from '@ValenceClient/admin/fetchAdmin';

type BackgroundJobsProps = {
  monitor: Monitor | null;
  isUnreachable?: boolean;
  pageSize?: number;
};

export type { BackgroundJobsProps };
