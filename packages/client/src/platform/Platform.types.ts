import type { Connect } from '@FluxClient/realtime/createRealtimeClient';

type DeviceStore = {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  forget: (key: string) => void;
};

type SignInElsewhere = {
  start: () => Promise<void>;
  whenDone: (then: () => void) => () => void;
};

type Platform = {
  store: DeviceStore;
  describeThisClient: () => string;
  thisClientId: () => string;
  whereTheServerIs: () => string;
  signInElsewhere: SignInElsewhere | null;
  changeServer: (() => void) | null;
  openSocket: Connect;
};

export type { DeviceStore, Platform, SignInElsewhere };
