import { describe, expect, it } from 'vitest';
import {
  decideViewing,
  SAME_VIEWING_MILLISECONDS,
  WORTH_REMEMBERING_SECONDS,
} from './decideViewing';
import type { OpenViewing } from './decideViewing';

const at = (millisecondsFromStart = 0) => new Date(1_700_000_000_000 + millisecondsFromStart);

const openViewing = (overrides: Partial<OpenViewing> = {}): OpenViewing => ({
  id: 'viewing-1',
  lastWatchedAt: at(),
  secondsWatched: 600,
  isFinished: false,
  ...overrides,
});

describe('deciding what a moment of watching does', () => {
  it('remembers something watched for long enough to count', () => {
    const decided = decideViewing(null, { at: at(), secondsWatched: 300, isFinished: false });

    expect(decided).toEqual({ kind: 'open', secondsWatched: 300, isFinished: false });
  });

  it('forgets something opened and immediately closed again', () => {
    expect(decideViewing(null, { at: at(), secondsWatched: 5, isFinished: false })).toEqual({
      kind: 'ignore',
    });
  });

  it('remembers something finished, however little of it was watched', () => {
    const decided = decideViewing(null, { at: at(), secondsWatched: 2, isFinished: true });

    expect(decided.kind).toBe('open');
  });

  it('keeps one sitting as one viewing however often it is picked up again', () => {
    const decided = decideViewing(openViewing(), {
      at: at(30 * 60_000),
      secondsWatched: 120,
      isFinished: false,
    });

    expect(decided).toEqual({
      kind: 'extend',
      id: 'viewing-1',
      secondsWatched: 720,
      isFinished: false,
    });
  });

  it('adds the watching up across a sitting rather than replacing it', () => {
    const decided = decideViewing(openViewing({ secondsWatched: 100 }), {
      at: at(60_000),
      secondsWatched: 50,
      isFinished: false,
    });

    expect(decided.kind === 'extend' && decided.secondsWatched).toBe(150);
  });

  it('starts a new viewing when somebody comes back another day', () => {
    const decided = decideViewing(openViewing(), {
      at: at(SAME_VIEWING_MILLISECONDS),
      secondsWatched: 300,
      isFinished: false,
    });

    expect(decided.kind).toBe('open');
  });

  it('counts a rewatch separately, which is the point of a log', () => {
    const finished = openViewing({ isFinished: true, secondsWatched: 7_200 });

    const decided = decideViewing(finished, {
      at: at(SAME_VIEWING_MILLISECONDS + 1),
      secondsWatched: 7_200,
      isFinished: true,
    });

    expect(decided).toEqual({ kind: 'open', secondsWatched: 7_200, isFinished: true });
  });

  it('remembers a viewing that finished, even once it is extended later', () => {
    const decided = decideViewing(openViewing({ isFinished: true }), {
      at: at(60_000),
      secondsWatched: 30,
      isFinished: false,
    });

    expect(decided.kind === 'extend' && decided.isFinished).toBe(true);
  });

  it('marks the open viewing finished when this is the moment it was', () => {
    const decided = decideViewing(openViewing(), {
      at: at(60_000),
      secondsWatched: 30,
      isFinished: true,
    });

    expect(decided.kind === 'extend' && decided.isFinished).toBe(true);
  });

  it('adds a scrap of watching to a sitting rather than forgetting it', () => {
    const decided = decideViewing(openViewing(), {
      at: at(60_000),
      secondsWatched: 5,
      isFinished: false,
    });

    expect(decided.kind).toBe('extend');
  });

  it('holds a sitting open across a long pause but not an absence', () => {
    const justInside = decideViewing(openViewing(), {
      at: at(SAME_VIEWING_MILLISECONDS - 1),
      secondsWatched: 10,
      isFinished: false,
    });

    const justOutside = decideViewing(openViewing(), {
      at: at(SAME_VIEWING_MILLISECONDS),
      secondsWatched: 300,
      isFinished: false,
    });

    expect(justInside.kind).toBe('extend');
    expect(justOutside.kind).toBe('open');
  });

  it('treats a report from a clock running behind as the same sitting', () => {
    const decided = decideViewing(openViewing(), {
      at: at(-60_000),
      secondsWatched: 10,
      isFinished: false,
    });

    expect(decided.kind).toBe('extend');
  });

  it('needs a full minute before remembering something nobody finished', () => {
    const under = decideViewing(null, {
      at: at(),
      secondsWatched: WORTH_REMEMBERING_SECONDS - 1,
      isFinished: false,
    });

    const over = decideViewing(null, {
      at: at(),
      secondsWatched: WORTH_REMEMBERING_SECONDS,
      isFinished: false,
    });

    expect(under.kind).toBe('ignore');
    expect(over.kind).toBe('open');
  });
});
