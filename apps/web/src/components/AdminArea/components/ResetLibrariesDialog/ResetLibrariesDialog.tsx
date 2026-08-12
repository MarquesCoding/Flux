import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import type { ResetLibrariesDialogProps } from './ResetLibrariesDialog.types';

/**
 * Asks before a rebuild, because a rebuild cannot be asked to stop.
 *
 * Every item in every library is deleted before a single one is re-added —
 * unlike a scan, which only ever adds to or corrects what is already there.
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
