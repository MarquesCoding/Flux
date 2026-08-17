import type { CreatedShare, NewShare, Share, ShareKind } from '@FluxContracts/schemas/Share';

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

type ShareService = {
  create: (createdBy: string, asked: NewShare) => Promise<CreatedShare | null>;
  list: (createdBy: string) => Promise<Share[]>;
  revoke: (createdBy: string, shareId: string) => Promise<boolean>;
  resolve: (token: string) => Promise<ResolvedShare | null>;
  join: (shareId: string, joiner: string) => Promise<void>;
};

export type { ShareService, ResolvedShare };
