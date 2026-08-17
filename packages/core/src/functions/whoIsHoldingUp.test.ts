import { describe, expect, it } from 'vitest';
import { whoIsHoldingUp } from './whoIsHoldingUp';
import type { Watcher } from './whoIsHoldingUp';

const NOW_MS = 10_000;

const watcher = (over?: Partial<Watcher>): Watcher => ({
  connectionId: 'dan',
  name: 'Dan',
  isReady: true,
  isWatching: true,
  positionSeconds: 100,
  reportedAtMs: NOW_MS,
  ...over,
});

const names = (held: readonly Watcher[]) => held.map((one) => one.name);

describe('whoIsHoldingUp', () => {
  it('waits for nobody when everybody is ready and together', () => {
    const held = whoIsHoldingUp(
      [watcher(), watcher({ connectionId: 'sam', name: 'Sam' })],
      'dan',
      NOW_MS,
    );

    expect(held).toEqual([]);
  });

  it('waits for somebody with nothing buffered to play', () => {
    const held = whoIsHoldingUp(
      [watcher(), watcher({ connectionId: 'sam', name: 'Sam', isReady: false })],
      'dan',
      NOW_MS,
    );

    expect(names(held)).toEqual(['Sam']);
  });

  it('waits for somebody who is nowhere near the rest, buffer or no buffer', () => {
    const held = whoIsHoldingUp(
      [watcher(), watcher({ connectionId: 'sam', name: 'Sam', positionSeconds: 40 })],
      'dan',
      NOW_MS,
    );

    expect(names(held)).toEqual(['Sam']);
  });

  it('does not wait for the ordinary second of difference between two players', () => {
    const held = whoIsHoldingUp(
      [watcher(), watcher({ connectionId: 'sam', name: 'Sam', positionSeconds: 99 })],
      'dan',
      NOW_MS,
    );

    expect(held).toEqual([]);
  });

  it('waits for whoever keeps time as readily as for anybody else', () => {
    const held = whoIsHoldingUp(
      [watcher({ isReady: false }), watcher({ connectionId: 'sam', name: 'Sam' })],
      'dan',
      NOW_MS,
    );

    expect(names(held)).toEqual(['Dan']);
  });

  it('compares positions at the same instant rather than as they were reported', () => {
    const held = whoIsHoldingUp(
      [
        watcher({ positionSeconds: 100, reportedAtMs: NOW_MS }),
        watcher({
          connectionId: 'sam',
          name: 'Sam',
          positionSeconds: 97,
          reportedAtMs: NOW_MS - 3000,
        }),
      ],
      'dan',
      NOW_MS,
    );

    expect(held).toEqual([]);
  });

  it('waits for nobody in a party whose timekeeper has gone, there being no reference', () => {
    expect(whoIsHoldingUp([watcher({ isReady: false })], null, NOW_MS)).toEqual([]);
  });

  it('names everybody who is holding it up, not merely the first', () => {
    const held = whoIsHoldingUp(
      [
        watcher(),
        watcher({ connectionId: 'sam', name: 'Sam', isReady: false }),
        watcher({ connectionId: 'kit', name: 'Kit', isReady: false }),
      ],
      'dan',
      NOW_MS,
    );

    expect(names(held)).toEqual(['Sam', 'Kit']);
  });
});
