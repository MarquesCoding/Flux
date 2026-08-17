import type { Avatar, ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type ProfileRequest = {
  name: string;
  colour: ProfileColour;
  avatar?: Avatar;
  askStillWatchingAfter?: number;
};

type ProfileService = {
  list: (userId: string) => Promise<ViewerProfile[]>;
  ensureDefault: (userId: string, name: string) => Promise<ViewerProfile>;
  create: (userId: string, request: ProfileRequest) => Promise<ViewerProfile>;
  rename: (userId: string, profileId: string, request: ProfileRequest) => Promise<boolean>;
  remove: (userId: string, profileId: string) => Promise<boolean>;
  belongsTo: (userId: string, profileId: string) => Promise<boolean>;
  moveTo: (profileId: string, newOwnerId: string) => Promise<boolean>;
  readAvatar: (profileId: string) => Promise<{ body: Uint8Array; contentType: string } | null>;
  listEveryone: () => Promise<ViewerProfile[]>;
  findSignInEmail: (profileId: string) => Promise<string | null>;
  accountOf: (profileId: string) => Promise<string | null>;
  savePhoto: (
    userId: string,
    profileId: string,
    photo: { body: Uint8Array; contentType: string },
  ) => Promise<boolean>;
};

export type { ProfileService };
