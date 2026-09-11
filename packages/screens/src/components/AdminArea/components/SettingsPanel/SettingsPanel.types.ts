import type { AdminOverview } from '@ValenceClient/admin/fetchAdmin';

type SettingsPanelProps = {
  overview: AdminOverview | null;
  onCatalogueKeySaved: () => void;
  onHardwareAccelSaved: () => void;
  onPreviewQualitySaved: () => void;
};

export type { SettingsPanelProps };
