import type { Job, JobDefinition } from '@ValenceClient/admin/fetchAdmin';
import type { Library } from '@ValenceContracts/schemas/Library';
import type { ScanEntry } from '@ValenceScreens/components/AdminArea/scanCoordinator';

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
