import type { Connect } from '@ValenceClient/realtime/createRealtimeClient';

type DeviceStore = {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type Platform = {
  store: DeviceStore;
  describeThisClient: () => string;
  thisClientId: () => string;
  canKeepFiles: () => boolean;
  openSocket: Connect;
};

export type { DeviceStore, Platform };
