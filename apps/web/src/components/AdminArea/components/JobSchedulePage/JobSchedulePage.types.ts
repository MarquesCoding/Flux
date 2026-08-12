import type { JobTrigger, ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';

type JobSchedulePageProps = {
  triggers: JobTrigger[];
  onAdd: (trigger: ScheduleTrigger) => void;
  onRemove: (triggerId: string) => void;
};

export type { JobSchedulePageProps };
