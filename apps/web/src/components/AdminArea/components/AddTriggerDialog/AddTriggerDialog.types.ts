import type { ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';

type AddTriggerDialogProps = {
  isOpen: boolean;
  onAdd: (trigger: ScheduleTrigger) => void;
  onClose: () => void;
  isSaving?: boolean;
};

export type { AddTriggerDialogProps };
