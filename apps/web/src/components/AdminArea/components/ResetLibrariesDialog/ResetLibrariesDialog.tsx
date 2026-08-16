import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import type { ResetLibrariesDialogProps } from './ResetLibrariesDialog.types';

/**
 * Asks before rebuilding every library from nothing, because a rebuild cannot be asked to stop once
 * started and everything the catalogue knew is discarded before anything is read back.
 *
 * @param isOpen - Whether the dialog is showing.
 * @param isResetting - Whether the rebuild is already under way.
 * @param onClose - Called when it is dismissed.
 * @param onConfirm - Called when the rebuild is agreed to.
 */
const ResetLibrariesDialog = ({
  isOpen,
  isResetting,
  onClose,
  onConfirm,
}: ResetLibrariesDialogProps) => (
  <Dialog label="Reset and rebuild every library" isOpen={isOpen} onClose={onClose}>
    <DialogTitle title="Reset and rebuild every library?" />

    <DialogContent className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        Every item in every library will be deleted, then probed and added again from scratch. Watch
        progress and marked intros for those items go with them. This cannot be undone.
      </p>
    </DialogContent>

    <DialogFooter>
      <Button variant="secondary" isPill onClick={onClose} disabled={isResetting}>
        Cancel
      </Button>

      <Button variant="danger" isPill isLoading={isResetting} onClick={onConfirm}>
        Reset and rebuild
      </Button>
    </DialogFooter>
  </Dialog>
);

ResetLibrariesDialog.displayName = 'ResetLibrariesDialog';

export { ResetLibrariesDialog };
