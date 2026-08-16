type Viewing = {
  id: string;
  mediaItemId: string;
  title: string | null;
  seriesTitle: string | null;
  startedAt: string;
  lastWatchedAt: string;
  secondsWatched: number;
  isFinished: boolean;
};

type HistoryService = {
  record: (
    profileId: string,
    mediaItemId: string,
    seen: { at: Date; secondsWatched: number; isFinished: boolean },
  ) => Promise<Viewing | null>;

  list: (profileId: string, options?: { limit?: number; offset?: number }) => Promise<Viewing[]>;

  forget: (profileId: string, viewingId: string) => Promise<boolean>;

  forgetAll: (profileId: string) => Promise<number>;

  prune: (before: Date) => Promise<number>;
};

export type { HistoryService, Viewing };
