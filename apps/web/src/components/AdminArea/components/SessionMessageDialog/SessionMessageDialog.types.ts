type SessionMessageDialogProps = {
  watcher: string;
  isOpen: boolean;
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
};

export type { SessionMessageDialogProps };
