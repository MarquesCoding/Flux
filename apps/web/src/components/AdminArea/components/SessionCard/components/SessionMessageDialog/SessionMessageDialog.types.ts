type SessionMessageDialogProps = {
  /**
   * Who the note is going to, so an admin looking at a list of tabs can see
   * they are about to interrupt the right one.
   */
  viewerName: string;
  isOpen: boolean;
  /**
   * Whether the message is in flight, so the dialog says so rather than
   * looking as though the press did nothing.
   */
  isBusy: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
};

export type { SessionMessageDialogProps };
