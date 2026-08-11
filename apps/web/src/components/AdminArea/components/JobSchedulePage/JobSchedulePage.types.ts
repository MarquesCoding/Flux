import type { JobDefinition, JobTrigger, ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin'

type JobSchedulePageProps = {
  definition: JobDefinition
  triggers: JobTrigger[]
  onAdd: (trigger: ScheduleTrigger) => void
  onRemove: (triggerId: string) => void
  onClose: () => void
}

export type { JobSchedulePageProps }
