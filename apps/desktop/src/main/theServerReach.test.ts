import { afterEach, describe, expect, it } from 'vitest';
import { theServerReach } from './theServerReach';
import type { ServerReach } from './theServerReach';

const WHERE = 'https://valence.test';

let reach: ServerReach | null = null;

const answering = (answers: (() => Promise<Response>)[]): typeof globalThis.fetch => {
  let asked = 0;

  const fetching: typeof globalThis.fetch = () => {
    const answer = answers[Math.min(asked, answers.length - 1)];

    asked += 1;

    return answer === undefined ? Promise.reject(new Error('nothing')) : answer();
  };

  return fetching;
};

const refused = (): Promise<Response> => Promise.reject(new Error('unreachable'));

const answered = (): Promise<Response> => Promise.resolve(new Response('ok'));

const soon = async (howLong = 40): Promise<void> => {
  await new Promise((carryOn) => setTimeout(carryOn, howLong));
};

afterEach(() => {
  reach?.stop();
  reach = null;
});

describe('theServerReach', () => {
  it('assumes the server is there until something says otherwise', () => {
    reach = theServerReach({ where: () => WHERE, fetching: answering([refused]), every: 10 });

    expect(reach.isReachable()).toBe(true);
  });

  it('says so when a request could not reach it', () => {
    reach = theServerReach({ where: () => WHERE, fetching: answering([refused]), every: 10_000 });

    reach.noteMissed();

    expect(reach.isReachable()).toBe(false);
  });

  it('tells whoever is listening, once, rather than on every failed request', () => {
    reach = theServerReach({ where: () => WHERE, fetching: answering([refused]), every: 10_000 });

    const told: boolean[] = [];

    reach.whenChanged((isReachable) => told.push(isReachable));

    reach.noteMissed();
    reach.noteMissed();
    reach.noteMissed();

    expect(told).toEqual([false]);
  });

  it('keeps asking while it is out of reach, because nothing else will', async () => {
    let asked = 0;

    const counting: typeof globalThis.fetch = () => {
      asked += 1;

      return refused();
    };

    reach = theServerReach({ where: () => WHERE, fetching: counting, every: 5 });

    reach.noteMissed();
    await soon(60);

    expect(asked).toBeGreaterThan(1);
  });

  it('comes back on its own when the server answers again', async () => {
    reach = theServerReach({
      where: () => WHERE,
      fetching: answering([refused, answered]),
      every: 5,
    });

    const told: boolean[] = [];

    reach.whenChanged((isReachable) => told.push(isReachable));

    reach.noteMissed();
    await soon();

    expect(reach.isReachable()).toBe(true);
    expect(told).toEqual([false, true]);
  });

  it('stops asking once it is back', async () => {
    let asked = 0;

    const counting: typeof globalThis.fetch = () => {
      asked += 1;

      return answered();
    };

    reach = theServerReach({ where: () => WHERE, fetching: counting, every: 5 });

    reach.noteMissed();
    await soon(30);

    const byThen = asked;

    await soon(30);

    expect(asked).toBe(byThen);
  });

  it('does not go looking for a server that was never chosen', async () => {
    let asked = 0;

    const counting: typeof globalThis.fetch = () => {
      asked += 1;

      return answered();
    };

    reach = theServerReach({ where: () => '', fetching: counting, every: 5 });

    reach.noteMissed();
    await soon(30);

    expect(asked).toBe(0);
    expect(reach.isReachable()).toBe(false);
  });

  it('treats a server that answered badly as a server that answered', () => {
    reach = theServerReach({ where: () => WHERE, fetching: answering([answered]), every: 10_000 });

    reach.noteMissed();
    reach.noteReached();

    expect(reach.isReachable()).toBe(true);
  });
});
