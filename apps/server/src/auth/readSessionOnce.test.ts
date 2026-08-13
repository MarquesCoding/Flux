import { describe, expect, it, vi } from 'vitest';
import { readSessionOnce } from './readSessionOnce';
import type { ResolvesSessions } from './readSessionOnce';
import type { FluxAuth } from './Auth';

type Session = Awaited<ReturnType<FluxAuth['api']['getSession']>>;

/**
 * An authentication layer that counts how often it is asked.
 *
 * Counting is the whole point: an API key is verified on every resolution and
 * charged to its own rate limit, so how many times one request asks is the
 * thing under test rather than an implementation detail.
 */
const countingAuth = (answer: Session = null) => {
  const getSession = vi.fn(() => Promise.resolve(answer));

  return { auth: { api: { getSession } } satisfies ResolvesSessions, getSession };
};

describe('readSessionOnce', () => {
  it('asks once however many times one request wants to know', async () => {
    const { auth, getSession } = countingAuth();
    const headers = new Headers({ cookie: 'session' });

    await readSessionOnce(auth, headers);
    await readSessionOnce(auth, headers);
    await readSessionOnce(auth, headers);

    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('gives every asker the same answer', async () => {
    const { auth } = countingAuth();
    const headers = new Headers();

    expect(await readSessionOnce(auth, headers)).toBe(await readSessionOnce(auth, headers));
  });

  it('asks again for a different request, so two never share an answer', async () => {
    const { auth, getSession } = countingAuth();

    await readSessionOnce(auth, new Headers({ cookie: 'one' }));
    await readSessionOnce(auth, new Headers({ cookie: 'two' }));

    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('asks once even when several askers arrive at the same moment', async () => {
    const { auth, getSession } = countingAuth();
    const headers = new Headers();

    await Promise.all([
      readSessionOnce(auth, headers),
      readSessionOnce(auth, headers),
      readSessionOnce(auth, headers),
    ]);

    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('answers with nobody rather than throwing when it cannot be read', async () => {
    const getSession = vi.fn((): Promise<Session> => Promise.reject(new Error('unreachable')));

    expect(await readSessionOnce({ api: { getSession } }, new Headers())).toBeNull();
  });

  it('remembers that nobody is signed in, rather than asking again', async () => {
    const { auth, getSession } = countingAuth();
    const headers = new Headers();

    await readSessionOnce(auth, headers);
    await readSessionOnce(auth, headers);

    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
