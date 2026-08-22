import type { ActiveSession } from '@ValenceClient/admin/fetchAdmin';

type ActivityPanelProps = {
  sessions: ActiveSession[];
  busyClientId: string | null;
  onStop: (clientId: string) => void;
  onPause: (clientId: string) => void;
  onResume: (clientId: string) => void;
  onMessage: (clientId: string, text: string) => Promise<void>;
};

export type { ActivityPanelProps };
