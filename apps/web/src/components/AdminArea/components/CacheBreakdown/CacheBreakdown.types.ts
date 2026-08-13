import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';

type CacheBreakdownProps = {
  /**
   * What the media service is holding, or null while it is still counting.
   */
  cache: Monitor['cache'];
  /**
   * What the API server is holding, which is artwork and nothing else.
   */
  artwork: AdminOverview['artwork'];
  /**
   * How many transcodes are actually running, so the working directories left
   * behind by the ones that are not can be told apart from them.
   */
  liveSessions: number;
  /**
   * How much the media itself takes, which is the one figure here that is not
   * Flux's own doing.
   */
  library: { bytes: number; itemCount: number } | null;
};

export type { CacheBreakdownProps };
