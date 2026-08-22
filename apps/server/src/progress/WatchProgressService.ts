import type { WatchProgress } from '@ValenceContracts/schemas/WatchProgress';

type ProgressReport = {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  isFinished: boolean;
};

type WatchProgressService = {
  list: (profileId: string) => Promise<WatchProgress[]>;
  read: (profileId: string, mediaId: string) => Promise<WatchProgress | null>;
  record: (profileId: string, report: ProgressReport) => Promise<void>;
  forget: (profileId: string, mediaId: string) => Promise<void>;
};

export type { ProgressReport, WatchProgressService };
