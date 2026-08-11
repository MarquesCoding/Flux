import type { Library } from '@FluxContracts/schemas/Library';
import type { JobDefinition } from '@FluxWeb/admin/fetchAdmin';
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
  onRun: (kind: string) => void;
  /**
   * Pressing a job's row anywhere but its Run button opens its own schedule
   * page — see `JobSchedulePage`, Jellyfin's scheduled-tasks page style.
   */
  onOpenSchedule: (kind: string) => void;
};

export type { JobRunnerProps };
