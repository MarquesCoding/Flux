import type { ActiveSession, AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';

type OverviewPanelProps = {
  overview: AdminOverview | null;
  monitor: Monitor | null;
  libraries: Library[];
  /**
   * Who has the app open, and what they are watching.
   */
  sessions: ActiveSession[];
  /**
   * Processor readings, so sustained load can be told from a busy moment.
   */
  history: number[];
  /**
   * Told which panel explains something somebody pressed.
   */
  onOpenPanel: (panel: string) => void;
};

export type { OverviewPanelProps };
