type ConfirmDialogProps = {
  title: string;
  detail: string;
  confirmLabel: string;
  isDestructive?: boolean;
  isBusy?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export type { ConfirmDialogProps };
