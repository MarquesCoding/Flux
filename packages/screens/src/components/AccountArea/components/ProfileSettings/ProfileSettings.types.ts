import type { Avatar, ProfileColour, ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

type ProfileDraft = {
  name: string;
  colour: ProfileColour;
  avatar: Avatar;
  askStillWatchingAfter: number;
  showsWhatIamWatching: boolean;
  photo: File | null;
};

type ProfileSettingsProps = {
  profile: ViewerProfile | null;
  draft: ProfileDraft | null;
  onDraft: (change: Partial<ProfileDraft>) => void;
};

export type { ProfileDraft, ProfileSettingsProps };
