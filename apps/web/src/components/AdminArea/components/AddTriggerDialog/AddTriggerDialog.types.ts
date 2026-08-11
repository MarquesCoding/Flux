import type { ScheduleTrigger } from '@FluxWeb/admin/fetchAdmin';

type AddTriggerDialogProps = {
  isOpen: boolean;
  onAdd: (trigger: ScheduleTrigger) => void;
  onClose: () => void;
  /**
   * Whether the trigger just added is still being saved.
   *
   * Held by the caller rather than here, because the dialog closes on a
   * successful save and it is the caller that knows when that happened.
   */
  isSaving?: boolean;
};

export type { AddTriggerDialogProps };
