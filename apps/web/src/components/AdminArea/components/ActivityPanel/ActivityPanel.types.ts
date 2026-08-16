import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type ActivityPanelProps = {
  sessions: ActiveSession[];
  busyClientId: string | null;
  onStop: (clientId: string) => void;
  onPause: (clientId: string) => void;
  onResume: (clientId: string) => void;
};

export type { ActivityPanelProps };
