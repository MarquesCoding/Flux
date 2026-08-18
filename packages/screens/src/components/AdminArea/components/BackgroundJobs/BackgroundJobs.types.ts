import type { Monitor } from '@FluxClient/admin/fetchAdmin';

type BackgroundJobsProps = {
  monitor: Monitor | null;
  isUnreachable?: boolean;
  pageSize?: number;
};

export type { BackgroundJobsProps };
