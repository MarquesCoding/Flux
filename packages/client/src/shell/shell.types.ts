import type { MediaSummary } from '@FluxContracts/schemas/Library';
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress';
import type { SessionUser } from '@FluxContracts/schemas/Session';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';
import type { WatchPartyState } from '@FluxClient/party/useWatchParty';

type MoodLight = {
  color: string;
  at?: string;
};

type StartOverride = { mediaId: string; seconds: number } | null;

type Shell = {
  title: string;
  user: SessionUser;
  watcher: ViewerProfile | null;
  household: readonly { id: string; name: string }[];
  known: ReadonlyMap<string, MediaSummary>;
  rememberItems: (items: MediaSummary[]) => void;
  progress: ReadonlyMap<string, WatchProgress>;
  reportProgress: (entry: WatchProgress) => void;
  readProgress: () => Promise<void>;
  startOverride: StartOverride;
  setStartOverride: (asked: StartOverride) => void;
  moodLights: MoodLight[];
  setMoodLights: (lights: MoodLight[]) => void;
  askingAbout: MediaSummary | null;
  setAskingAbout: (media: MediaSummary | null) => void;
  watchParty: WatchPartyState;
  refresh: () => Promise<void>;
};

export type { MoodLight, Shell, StartOverride };
