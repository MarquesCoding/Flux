import type { AdminOverview, Monitor } from '@FluxWeb/admin/fetchAdmin';
import type { Library } from '@FluxContracts/schemas/Library';

type OverviewPanelProps = {
  overview: AdminOverview | null;
  monitor: Monitor | null;
  libraries: Library[];
  /**
   * How many people have the app open, so the quiet state can say whether
   * quiet means idle or means busy and fine.
   */
  sessionCount: number;
  /**
   * Told which panel explains a concern somebody pressed.
   */
  onOpenPanel: (panel: string) => void;
};

export type { OverviewPanelProps };
