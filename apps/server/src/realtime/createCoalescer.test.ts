import { describe, expect, it } from 'vitest';
import { createCoalescer } from './createCoalescer';
import type { Coalesced, Schedule } from './createCoalescer';

const createClock = () => {
  const due: { run: () => void; cancelled: boolean }[] = [];

  const schedule: Schedule = (run) => {
    const entry = { run, cancelled: false };

    due.push(entry);

    return () => {
      entry.cancelled = true;
    };
  };

  return {
    schedule,
    pending: () => due.filter((entry) => !entry.cancelled).length,
    tick: () => {
      const ready = due.splice(0, due.length);

      for (const entry of ready) {
        if (!entry.cancelled) {
          entry.run();
        }
      }
    },
  };
};

const createSink = () => {
  const sent: { key: string; coalesced: Coalesced }[] = [];

  return { sent, flush: (key: string, coalesced: Coalesced) => sent.push({ key, coalesced }) };
};

describe('createCoalescer', () => {
  it('sends nothing until the window closes', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });

    expect(sink.sent).toStrictEqual([]);

    clock.tick();

    expect(sink.sent).toHaveLength(1);
  });

  it('sends one event for a flood, carrying how many were folded in', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    for (let index = 0; index < 4000; index += 1) {
      coalescer.offer('media', { added: index });
    }

    clock.tick();

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0]?.coalesced.folded).toBe(3999);
  });

  it('keeps the most recent payload rather than the first', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });
    coalescer.offer('media', { added: 2 });
    clock.tick();

    expect(sink.sent[0]?.coalesced.payload).toStrictEqual({ added: 2 });
  });

  it('reports nothing folded where a single event stood alone', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });
    clock.tick();

    expect(sink.sent[0]?.coalesced.folded).toBe(0);
  });

  it('never folds two different keys together', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });
    coalescer.offer('notifications', { unread: 2 });
    clock.tick();

    expect(sink.sent.map((entry) => entry.key)).toStrictEqual(['media', 'notifications']);
  });

  it('opens a fresh window for an event arriving after the last one was sent', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });
    clock.tick();
    coalescer.offer('media', { added: 2 });
    clock.tick();

    expect(sink.sent).toHaveLength(2);
    expect(sink.sent[1]?.coalesced.folded).toBe(0);
  });

  it('drops what it was holding when stopped, and cancels the wait', () => {
    const clock = createClock();
    const sink = createSink();
    const coalescer = createCoalescer({
      windowMs: 50,
      schedule: clock.schedule,
      flush: sink.flush,
    });

    coalescer.offer('media', { added: 1 });
    coalescer.stop();
    clock.tick();

    expect(sink.sent).toStrictEqual([]);
    expect(clock.pending()).toBe(0);
  });
});
