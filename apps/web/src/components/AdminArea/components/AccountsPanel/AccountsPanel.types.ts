import type { AdminOverview } from '@FluxWeb/admin/fetchAdmin';

type AccountsPanelProps = {
  /**
   * Everyone with an account. Read from the overview the admin area already
   * fetches rather than asked for again.
   */
  accounts: AdminOverview['users'];
};

export type { AccountsPanelProps };
