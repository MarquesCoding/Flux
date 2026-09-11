import { describe, expect, it, vi } from 'vitest';
import type * as Undici from 'undici';

type AgentOptions = { headersTimeout?: number };

const agentsMade = vi.hoisted((): { count: number; options: AgentOptions[] } => ({
  count: 0,
  options: [],
}));

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof Undici>('undici');

  return {
    ...actual,
    Agent: class {
      constructor(options: { headersTimeout?: number }) {
        agentsMade.count += 1;
        agentsMade.options.push(options);
      }
    },
    fetch: () => Promise.resolve({ ok: true, body: null }),
  };
});

const { createTranscoderClient } = await import('./TranscoderClient');

const AGENTS_PER_CLIENT = 3;

describe('the connection pool', () => {
  it('is made once for a client, not once per stream opened', async () => {
    agentsMade.count = 0;

    const client = createTranscoderClient({ baseUrl: 'unix:/tmp/valence-test.sock' });

    await client.openMonitorStream();
    await client.openMonitorStream();
    await client.openMonitorStream();

    expect(agentsMade.count).toBeLessThanOrEqual(AGENTS_PER_CLIENT);
  });
});

describe('how long a render is given', () => {
  it('is not given a clock at all, since a sheet takes as long as the film is', () => {
    agentsMade.options.length = 0;

    createTranscoderClient({ baseUrl: 'unix:/tmp/valence-test.sock' });

    expect(agentsMade.options.some((options) => options?.headersTimeout === 0)).toBe(true);
  });

  it('still holds an ordinary question to a minute, which is a question about a file', () => {
    agentsMade.options.length = 0;

    createTranscoderClient({ baseUrl: 'unix:/tmp/valence-test.sock' });

    expect(agentsMade.options.some((options) => options?.headersTimeout === 60_000)).toBe(true);
  });
});
