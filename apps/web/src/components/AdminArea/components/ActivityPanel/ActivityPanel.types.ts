import type { ActiveSession } from '@FluxWeb/admin/fetchAdmin';

type ActivityPanelProps = {
  sessions: ActiveSession[];
  /**
   * Which session is waiting on a command, so its card can say so rather than
   * looking as though the press did nothing.
   */
  busyClientId: string | null;
  onStop: (clientId: string) => void;
  onPause: (clientId: string) => void;
  onResume: (clientId: string) => void;
};

export type { ActivityPanelProps };
