import type { AdminOverview } from '@FluxClient/admin/fetchAdmin';

type SettingsPanelProps = {
  overview: AdminOverview | null;
  onCatalogueKeySaved: () => void;
  onHardwareAccelSaved: () => void;
};

export type { SettingsPanelProps };
