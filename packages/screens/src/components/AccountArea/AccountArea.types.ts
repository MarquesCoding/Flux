import type { SessionUser } from '@FluxContracts/schemas/Session';

type AccountAreaProps = {
  user: SessionUser;
  onChanged: () => void;
  onSignOut: () => void;
};

export type { AccountAreaProps };
