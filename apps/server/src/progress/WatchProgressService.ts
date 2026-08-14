import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';

type ProgressReport = {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  isFinished: boolean;
};

/**
 * Where each person got to, as the HTTP layer sees it.
 *
 * Keyed on a profile rather than an account, so that a household sharing one
 * login does not share one continue watching row — and so that moving somebody
 * to an account of their own carries their viewing with them.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one.
 */
type WatchProgressService = {
  list: (profileId: string) => Promise<WatchProgress[]>;
  /**
   * Where somebody had got to in one thing, before this report.
   *
   * Asked for by name rather than found in the list, because it is read on
   * every progress report — and reading a profile's whole viewing to answer a
   * question about one item is the sort of thing that is fine until somebody
   * has watched a thousand of them.
   */
  read: (profileId: string, mediaId: string) => Promise<WatchProgress | null>;
  record: (profileId: string, report: ProgressReport) => Promise<void>;
  forget: (profileId: string, mediaId: string) => Promise<void>;
};

export type { ProgressReport, WatchProgressService };
