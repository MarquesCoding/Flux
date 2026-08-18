import type { ActiveSession, AdminOverview, Monitor } from '@FluxClient/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';

type OverviewPanelProps = {
  overview: AdminOverview | null;
  monitor: Monitor | null;
  libraries: Library[];
  sessions: ActiveSession[];
  history: number[];
  onOpenPanel: (panel: string) => void;
};

export type { OverviewPanelProps };
