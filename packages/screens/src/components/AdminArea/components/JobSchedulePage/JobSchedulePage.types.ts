import type { JobTrigger, ScheduleTrigger } from '@ValenceClient/admin/fetchAdmin';

type JobSchedulePageProps = {
  triggers: JobTrigger[];
  onAdd: (trigger: ScheduleTrigger) => void;
  onRemove: (triggerId: string) => void;
  timezone?: string | null;
};

export type { JobSchedulePageProps };
