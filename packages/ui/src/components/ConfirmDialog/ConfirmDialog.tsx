import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

/**
 * Asks before something that cannot be taken back.
 */
const ConfirmDialog = ({
  title,
  detail,
  confirmLabel,
  isDestructive = false,
  isBusy = false,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => (
  <Dialog label={title} isOpen={isOpen} onClose={onClose} className="sm:w-[min(28rem,92vw)]">
    <DialogTitle title={title} />

    <DialogContent>
      <p className="font-body text-sm text-text-muted">{detail}</p>
    </DialogContent>

    <DialogFooter>
      <Button variant="secondary" isPill onClick={onClose} disabled={isBusy}>
        Cancel
      </Button>

      <Button
        variant={isDestructive ? 'danger' : 'glossy'}
        isPill
        isLoading={isBusy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </DialogFooter>
  </Dialog>
);

ConfirmDialog.displayName = 'ConfirmDialog';

export { ConfirmDialog };
