import type { AdminOverview, Monitor } from '@ValenceClient/admin/fetchAdmin';

type CacheBreakdownProps = {
  cache: Monitor['cache'];
  artwork: AdminOverview['artwork'];
  liveSessions: number;
  library: { bytes: number; itemCount: number } | null;
};

export type { CacheBreakdownProps };
