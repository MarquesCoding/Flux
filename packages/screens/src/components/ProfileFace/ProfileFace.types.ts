import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

type ProfileFaceProps = {
  profile: ViewerProfile;
  pending?: File | null;
  className?: string;
};

export type { ProfileFaceProps };
