type AdminDialogProps = {
  panel: string | null;
  job: string | null;
  onPanel: (panel: string) => void;
  onJob: (job: string | null) => void;
  onClose: () => void;
};

export type { AdminDialogProps };
