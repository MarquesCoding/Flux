import type { Connect } from '@FluxClient/realtime/createRealtimeClient';

type DeviceStore = {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type Platform = {
  store: DeviceStore;
  describeThisClient: () => string;
  thisClientId: () => string;
  whereTheServerIs: () => string;
  openSocket: Connect;
};

export type { DeviceStore, Platform };
