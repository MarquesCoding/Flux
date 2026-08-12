type ConfirmDialogProps = {
  /**
   * The question, in a few words.
   */
  title: string;
  /**
   * What will happen, and whether it can be undone.
   */
  detail: string;
  /**
   * What the affirmative button says. A verb naming the act rather than "OK",
   * so the button can be read on its own.
   */
  confirmLabel: string;
  /**
   * Whether this destroys something, which colours the button.
   */
  isDestructive?: boolean;
  isBusy?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export type { ConfirmDialogProps };
