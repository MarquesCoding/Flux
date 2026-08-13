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
  /**
   * Told once a backend has been chosen, for the same reason.
   *
   * The badge in the header reports what is in force, and it reads what the
   * overview says rather than what this panel remembers — so without this it
   * keeps announcing the old choice until the page is loaded again.
   */
  onHardwareAccelSaved: () => void;
};

export type { SettingsPanelProps };
