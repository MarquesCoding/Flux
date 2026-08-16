import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type SessionCardProps = {
  session: ActiveSession;
  isBusy: boolean;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
};

export type { SessionCardProps };
