import type { AdminOverview } from '@FluxWeb/admin/fetchAdmin';

type RolesPanelProps = {
  /**
   * Everyone with an account, for assigning roles to. Read from the overview
   * the admin area already fetches rather than asked for again.
   */
  accounts: AdminOverview['users'];
};

export type { RolesPanelProps };
