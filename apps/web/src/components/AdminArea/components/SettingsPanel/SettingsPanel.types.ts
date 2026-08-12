import type { AdminOverview } from '@FluxWeb/admin/fetchAdmin';

type SettingsPanelProps = {
  /**
   * What the server says about itself, or null before it has answered.
   */
  overview: AdminOverview | null;
  /**
   * Told once a key has been saved, so whatever fetched the overview can
   * fetch it again — the panel changes something it does not own.
   */
  onCatalogueKeySaved: () => void;
};

export type { SettingsPanelProps };
