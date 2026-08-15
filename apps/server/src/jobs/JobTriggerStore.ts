import type { ScheduleTrigger } from './scheduleTrigger';

type StoredTrigger = {
  id: string;
  kind: string;
  trigger: ScheduleTrigger;
};

type JobTriggerStore = {
  list: () => Promise<StoredTrigger[]>;
  add: (kind: string, trigger: ScheduleTrigger) => Promise<StoredTrigger>;
  remove: (kind: string, triggerId: string) => Promise<boolean>;
};

export type { JobTriggerStore, StoredTrigger };
