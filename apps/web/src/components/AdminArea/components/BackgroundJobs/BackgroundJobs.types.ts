import type { Monitor } from '@FluxWeb/admin/fetchAdmin';

type BackgroundJobsProps = {
  monitor: Monitor | null;
  isUnreachable?: boolean;
  pageSize?: number;
};

export type { BackgroundJobsProps };
