import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { DialogTitle } from '@ValenceUI/DialogTitle';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

/**
 * Asks before something that cannot be undone, and says plainly what will happen rather than asking
 * whether somebody is sure. A destructive answer is painted as destructive, and the dialog stays
 * open and busy while the work runs, so nothing is confirmed twice.
 *
 * @param title - What is about to happen.
 * @param detail - What it will do, in words somebody can weigh.
 * @param confirmLabel - What the confirming button says, which should name the action.
 * @param isDestructive - Whether the answer destroys something, which changes how it is painted.
 * @param isBusy - Whether the work is already running.
 * @param isOpen - Whether the dialog is showing.
 * @param onClose - Told when it was dismissed without confirming.
 * @param onConfirm - Told when it was confirmed.
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
