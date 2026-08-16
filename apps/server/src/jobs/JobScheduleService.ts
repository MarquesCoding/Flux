import type { ScheduleTrigger } from './scheduleTrigger';

type JobTrigger = {
  id: string;
  trigger: ScheduleTrigger;
};

type JobSchedule = {
  kind: string;
  triggers: JobTrigger[];
};

type JobScheduleService = {
  list: () => Promise<JobSchedule[]>;
  add: (kind: string, trigger: ScheduleTrigger) => Promise<JobTrigger | null>;
  remove: (kind: string, triggerId: string) => Promise<boolean>;
  sync: () => Promise<string[]>;
};

export type { JobSchedule, JobScheduleService, JobTrigger };
