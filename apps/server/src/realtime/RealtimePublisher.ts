import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';
import type { RealtimeTopic } from '@ValenceContracts/schemas/Realtime';
import type { Reach } from './createRealtimeRegistry';

type RealtimePublisher = {
  publish: (topic: RealtimeTopic, payload: JsonValue, reach: Reach) => void;
  recheck: (accountId: string) => Promise<void>;
  recheckAll: () => Promise<void>;
};

export type { RealtimePublisher };
