type PartyPasswordDialogProps = {
  isOpen: boolean;
  wasWrong: boolean;
  onJoin: (password: string) => void;
  onClose: () => void;
};

export type { PartyPasswordDialogProps };
