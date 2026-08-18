import type {
  AdminShare,
  CreatedShare,
  NewShare,
  Share,
  ShareKind,
} from '@FluxContracts/schemas/Share';

type ResolvedShare = {
  id: string;
  kind: ShareKind;
  mediaId: string | null;
  seriesId: string | null;
  title: string;
  expiresAt: Date | null;
  viewCap: number | null;
  views: number;
  revokedAt: Date | null;
};

type WithdrawnShare = {
  createdBy: string;
  title: string;
};

type ShareService = {
  create: (createdBy: string, asked: NewShare) => Promise<CreatedShare | null>;
  list: (createdBy: string) => Promise<Share[]>;
  listEverybody: () => Promise<AdminShare[]>;
  revoke: (createdBy: string, shareId: string) => Promise<boolean>;
  revokeAnybody: (shareId: string) => Promise<WithdrawnShare | null>;
  resolve: (token: string) => Promise<ResolvedShare | null>;
  join: (shareId: string, joiner: string) => Promise<void>;
};

export type { ShareService, ResolvedShare, WithdrawnShare };
