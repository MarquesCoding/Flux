import type { SessionUser } from '@ValenceContracts/schemas/Session';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';
import type { ProfileDraft } from '@ValenceScreens/components/AccountArea/components/ProfileSettings/ProfileSettings.types';

type AccountAreaProps = {
  user: SessionUser;
  panel: string;
  profile: ViewerProfile | null;
  draft: ProfileDraft | null;
  onDraft: (change: Partial<ProfileDraft>) => void;
  onChanged: () => void;
};

export type { AccountAreaProps };
