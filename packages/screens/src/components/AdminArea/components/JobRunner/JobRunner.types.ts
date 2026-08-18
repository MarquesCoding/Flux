import type { Job, JobDefinition } from '@FluxClient/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';
import type { ScanEntry } from '@FluxScreens/components/AdminArea/scanCoordinator';

type JobRunnerProps = {
  definitions: JobDefinition[];
  libraries: Library[];
  progress: ReadonlyMap<string, ScanEntry>;
  working: Job[];
  onRun: (kind: string) => void;
  onStop: (kind: string) => void;
  onOpenSchedule: (kind: string) => void;
};

export type { JobRunnerProps };
