import type { ActiveSession } from '@ValenceClient/admin/fetchAdmin';

type SessionStatsDialogProps = {
  session: ActiveSession;
  isOpen: boolean;
  onClose: () => void;
};

export type { SessionStatsDialogProps };
