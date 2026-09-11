import { describe, expect, it, vi } from 'vitest';
import { createCatalogueGate } from './createCatalogueGate';

describe('createCatalogueGate', () => {
  it('lets a request through without ceremony', async () => {
    await expect(createCatalogueGate(2).run(() => Promise.resolve('answered'))).resolves.toBe(
      'answered',
    );
  });

  it('holds a request back once the width is taken', async () => {
    const gate = createCatalogueGate(2);
    let inFlight = 0;
    let mostAtOnce = 0;

    const asking = Array.from({ length: 6 }, async () =>
      gate.run(async () => {
        inFlight += 1;
        mostAtOnce = Math.max(mostAtOnce, inFlight);

        await new Promise((resolve) => setTimeout(resolve, 5));

        inFlight -= 1;
      }),
    );

    await Promise.all(asking);

    expect(mostAtOnce).toBe(2);
  });

  it('gives the slot back even where the request failed', async () => {
    const gate = createCatalogueGate(1);

    await expect(gate.run(() => Promise.reject(new Error('refused')))).rejects.toThrow('refused');
    await expect(gate.run(() => Promise.resolve('through'))).resolves.toBe('through');
  });

  it('makes everything wait once the catalogue has said it has had enough', async () => {
    vi.useFakeTimers();

    const gate = createCatalogueGate(4);
    const ran: string[] = [];

    gate.holdFor(1000);

    const asking = Promise.all([
      gate.run(() => {
        ran.push('first');

        return Promise.resolve();
      }),
      gate.run(() => {
        ran.push('second');

        return Promise.resolve();
      }),
    ]);

    await vi.advanceTimersByTimeAsync(0);

    expect(ran).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    await asking;

    expect(ran).toEqual(['first', 'second']);

    vi.useRealTimers();
  });

  it('keeps the longest hold it was given rather than the latest', async () => {
    vi.useFakeTimers();

    const gate = createCatalogueGate(1);

    gate.holdFor(5000);
    gate.holdFor(10);

    let through = false;
    const asking = gate.run(() => {
      through = true;

      return Promise.resolve();
    });

    await vi.advanceTimersByTimeAsync(20);

    expect(through).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    await asking;

    expect(through).toBe(true);

    vi.useRealTimers();
  });
});
