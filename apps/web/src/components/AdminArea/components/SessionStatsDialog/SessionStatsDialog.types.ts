import type { ActiveSession } from '@FluxClient/admin/fetchAdmin';

type SessionStatsDialogProps = {
  session: ActiveSession;
  isOpen: boolean;
  onClose: () => void;
};

export type { SessionStatsDialogProps };
