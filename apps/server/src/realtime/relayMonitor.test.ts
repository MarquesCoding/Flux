import { describe, expect, it } from 'vitest';
import { relayMonitor } from './relayMonitor';
import type { JsonValue } from '@ValenceContracts/schemas/JsonValue';

const streamOf = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

const createRun = (opens: (() => Promise<ReadableStream<Uint8Array> | null>)[]) => {
  const published: JsonValue[] = [];
  const waits: number[] = [];
  let attempt = 0;

  const run = relayMonitor({
    open: () => {
      const next = opens[attempt] ?? (() => Promise.resolve(null));

      attempt += 1;

      return next();
    },
    publish: (report) => published.push(report),
    wait: (afterMs) => {
      waits.push(afterMs);

      return Promise.resolve();
    },
    retryMs: 100,
    keepGoing: () => attempt < opens.length,
  });

  return { run, published, waits };
};

describe('relayMonitor', () => {
  it('publishes each report the transcoder sends', async () => {
    const relay = createRun([() => Promise.resolve(streamOf('data: {"queued":2}\n\n'))]);

    await relay.run;

    expect(relay.published).toStrictEqual([{ queued: 2 }]);
  });

  it('publishes every report on one connection, not just the first', async () => {
    const relay = createRun([
      () => Promise.resolve(streamOf('data: {"queued":1}\n\ndata: {"queued":2}\n\n')),
    ]);

    await relay.run;

    expect(relay.published).toStrictEqual([{ queued: 1 }, { queued: 2 }]);
  });

  it('opens the stream again after it ends, since the page is still being watched', async () => {
    const relay = createRun([
      () => Promise.resolve(streamOf('data: {"queued":1}\n\n')),
      () => Promise.resolve(streamOf('data: {"queued":2}\n\n')),
    ]);

    await relay.run;

    expect(relay.published).toStrictEqual([{ queued: 1 }, { queued: 2 }]);
  });

  it('waits before trying a transcoder that would not open at all', async () => {
    const relay = createRun([() => Promise.resolve(null)]);

    await relay.run;

    expect(relay.waits).toStrictEqual([100]);
  });

  it('says the transcoder is unreachable rather than throwing when it fails', async () => {
    const relay = createRun([() => Promise.reject(new Error('connection refused'))]);

    await relay.run;

    expect(relay.published).toStrictEqual([{ reachable: false }]);
  });

  it('carries on after a failure instead of giving up', async () => {
    const relay = createRun([
      () => Promise.reject(new Error('connection refused')),
      () => Promise.resolve(streamOf('data: {"queued":1}\n\n')),
    ]);

    await relay.run;

    expect(relay.published).toStrictEqual([{ reachable: false }, { queued: 1 }]);
  });

  it('ignores a frame that is not the report it expected', async () => {
    const relay = createRun([() => Promise.resolve(streamOf('data: not json\n\n'))]);

    await relay.run;

    expect(relay.published).toStrictEqual([]);
  });

  it('stops when told to stop', async () => {
    const relay = createRun([]);

    await relay.run;

    expect(relay.published).toStrictEqual([]);
  });
});
