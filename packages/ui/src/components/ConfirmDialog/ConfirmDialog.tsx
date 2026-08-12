import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { DialogFooter } from '@FluxUI/DialogFooter';
import { DialogTitle } from '@FluxUI/DialogTitle';
import type { ConfirmDialogProps } from './ConfirmDialog.types';

/**
 * Asks before something that cannot be taken back.
 *
 * One component rather than a confirmation written out wherever one is needed,
 * so the wording, the ordering of the buttons and the colour of the dangerous
 * one are decided once. A confirmation that looks different each time it
 * appears trains somebody to press through it without reading.
 *
 * The affirmative button names the act — "Ban", "Delete account" — rather than
 * saying yes. It is the only part of the dialog somebody is guaranteed to
 * read, so it is the part that should say what happens.
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
