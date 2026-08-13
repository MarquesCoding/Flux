import { describe, expect, it, vi } from 'vitest';
import { recordSignIn, SAME_VISIT_MILLISECONDS } from './recordSignIn';

const storeThatCounts = () => {
  const record = vi.fn(() => Promise.resolve(1));

  return { store: { record }, record };
};

const at = (millisecondsFromNow = 0) => new Date(1_700_000_000_000 + millisecondsFromNow);

describe('recordSignIn', () => {
  it('records the first time an account is ever seen', async () => {
    const { store, record } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(),
      lastSignInAt: null,
    });

    expect(outcome.counted).toBe(true);
    expect(record).toHaveBeenCalledWith('user-1', at());
  });

  it('records somebody arriving again the next day', async () => {
    const { store, record } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(86_400_000),
      lastSignInAt: at(),
    });

    expect(outcome.counted).toBe(true);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('folds a refresh into the visit it belongs to', async () => {
    const { store, record } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(1_000),
      lastSignInAt: at(),
    });

    expect(outcome.counted).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it('folds a second device waking a moment later into the same visit', async () => {
    const { store } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(SAME_VISIT_MILLISECONDS - 1),
      lastSignInAt: at(),
    });

    expect(outcome.counted).toBe(false);
  });

  it('counts an arrival once the last one is old enough to be a different visit', async () => {
    const { store } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(SAME_VISIT_MILLISECONDS),
      lastSignInAt: at(),
    });

    expect(outcome.counted).toBe(true);
  });

  it('counts a sign-in that somehow arrives before the last one, rather than losing it', async () => {
    const { store } = storeThatCounts();

    const outcome = await recordSignIn({
      store,
      userId: 'user-1',
      at: at(-86_400_000),
      lastSignInAt: at(),
    });

    expect(outcome.counted).toBe(true);
  });
});
