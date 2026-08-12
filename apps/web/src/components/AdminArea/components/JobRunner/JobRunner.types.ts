import type { Job, JobDefinition } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

type JobRunnerProps = {
  definitions: JobDefinition[];
  libraries: Library[];
  /**
   * Every library job currently tracked, keyed by library id for a
   * library-scoped job or by kind for one that is not.
   *
   * Read rather than owned: `scanCoordinator` is the single source of truth
   * for what is running, so a row disables its own Run button by finding
   * itself here instead of keeping separate state.
   */
  progress: ReadonlyMap<string, ScanEntry>;
  /**
   * A library-scoped job always runs against every library — picking one is
   * what the Libraries panel's own buttons are for.
   */
  /**
   * What the queue is actually chewing on, so a running row can name the file
   * it is on rather than only counting them.
   */
  working: Job[];
  onRun: (kind: string) => void;
  /**
   * Asks every run of a kind to stop.
   *
   * Offered only while something of that kind is running — a job that is not
   * running has nothing to stop, and a menu item that does nothing is worse
   * than one that is not there.
   */
  onStop: (kind: string) => void;
  /**
   * Pressing a job's row anywhere but its Run button opens its own schedule
   * page — see `JobSchedulePage`, Jellyfin's scheduled-tasks page style.
   */
  onOpenSchedule: (kind: string) => void;
};

export type { JobRunnerProps };
