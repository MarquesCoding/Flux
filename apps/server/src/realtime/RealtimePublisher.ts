import type { JsonValue } from '@FluxContracts/schemas/JsonValue';
import type { RealtimeTopic } from '@FluxContracts/schemas/Realtime';
import type { Reach } from './createRealtimeRegistry';

type RealtimePublisher = {
  publish: (topic: RealtimeTopic, payload: JsonValue, reach: Reach) => void;
  recheck: (accountId: string) => Promise<void>;
  recheckAll: () => Promise<void>;
};

export type { RealtimePublisher };
