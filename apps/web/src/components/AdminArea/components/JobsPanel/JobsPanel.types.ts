import type {
  JobDefinition,
  JobTrigger,
  Monitor,
  ScheduleTrigger,
} from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxWeb/components/AdminArea/scanCoordinator';

type JobsPanelProps = {
  definitions: JobDefinition[];
  libraries: Library[];
  progress: ReadonlyMap<string, ScanEntry>;
  /**
   * The latest reading, which is where the queue is read from.
   */
  monitor: Monitor | null;
  /**
   * Which job's schedule is open, or null while the list is showing.
   */
  viewingJobKind: string | null;
  schedules: Map<string, JobTrigger[]>;
  onRun: (kind: string) => void;
  onOpenSchedule: (kind: string) => void;
  onCloseSchedule: () => void;
  onAddTrigger: (kind: string, trigger: ScheduleTrigger) => void;
  onRemoveTrigger: (kind: string, triggerId: string) => void;
};

export type { JobsPanelProps };
