import { describe, expect, it, vi } from 'vitest';
import type * as Undici from 'undici';

const agentsMade = vi.hoisted(() => ({ count: 0 }));

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof Undici>('undici');

  return {
    ...actual,
    Agent: class {
      constructor() {
        agentsMade.count += 1;
      }
    },
    fetch: () => Promise.resolve({ ok: true, body: null }),
  };
});

const { createTranscoderClient } = await import('./TranscoderClient');

describe('the connection pool', () => {
  it('is made once for a client, not once per stream opened', async () => {
    agentsMade.count = 0;

    const client = createTranscoderClient({ baseUrl: 'unix:/tmp/valence-test.sock' });

    await client.openMonitorStream();
    await client.openMonitorStream();
    await client.openMonitorStream();

    expect(agentsMade.count).toBeLessThanOrEqual(2);
  });
});
