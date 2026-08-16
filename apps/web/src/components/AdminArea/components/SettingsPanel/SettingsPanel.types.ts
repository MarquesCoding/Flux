import type { AdminOverview } from '@FluxWeb/admin/fetchAdmin';

type SettingsPanelProps = {
  overview: AdminOverview | null;
  onCatalogueKeySaved: () => void;
  onHardwareAccelSaved: () => void;
};

export type { SettingsPanelProps };
