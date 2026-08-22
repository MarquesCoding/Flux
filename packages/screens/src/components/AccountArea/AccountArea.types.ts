import type { SessionUser } from '@ValenceContracts/schemas/Session';

type AccountAreaProps = {
  user: SessionUser;
  onChanged: () => void;
  onSignOut: () => void;
};

export type { AccountAreaProps };
