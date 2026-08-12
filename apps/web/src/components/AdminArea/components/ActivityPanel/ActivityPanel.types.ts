import type { ActiveSession, Monitor } from '@FluxWeb/admin/fetchAdmin';

type ActivityPanelProps = {
  /**
   * Processor readings, oldest first. A minute of them at one a second.
   */
  history: number[];
  /**
   * The latest reading, which is where the conversions come from.
   */
  monitor: Monitor | null;
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
