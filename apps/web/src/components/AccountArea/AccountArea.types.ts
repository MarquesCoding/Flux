import type { SessionUser } from '@FluxContracts/schemas/Session';

type AccountAreaProps = {
  user: SessionUser;
  /**
   * Called when something changed that the rest of the application reads —
   * a name, a picture, a second factor.
   */
  onChanged: () => void;
  onSignOut: () => void;
};

export type { AccountAreaProps };
