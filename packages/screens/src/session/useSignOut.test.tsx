import { act, renderHook, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shellContext } from '@ValenceClient/shell/shellContext';
import { aShell } from '@ValenceClient/testing/aShell';
import { signOut } from '@ValenceClient/session/auth';
import { notify } from '@ValenceUI/notify';
import { AddressScope } from '@ValenceScreens/testing/AddressScope';
import { usePlace } from '@ValenceScreens/navigation/usePlace';
import { useSignOut } from './useSignOut';
import type { ReactNode } from 'react';
import type * as Auth from '@ValenceClient/session/auth';
import type * as Notify from '@ValenceUI/notify';

vi.mock('@ValenceClient/session/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  signOut: vi.fn(),
}));

vi.mock('@ValenceUI/notify', async (importOriginal) => {
  const original = await importOriginal<typeof Notify>();

  return { ...original, notify: { ...original.notify, failed: vi.fn() } };
});

const ended = vi.mocked(signOut);

const refresh = vi.fn(() => Promise.resolve());

const Scope = ({ children }: { children: ReactNode }) => (
  <shellContext.Provider value={aShell({ refresh })}>
    <AddressScope>{children}</AddressScope>
  </shellContext.Provider>
);

/**
 * Runs the hook beside the cache and the address it acts on, with the account dialog open.
 *
 * @returns The hook, the cache and the place, as the test last saw them.
 */
const drawOpenOnTheAccount = async () => {
  const view = renderHook(
    () => ({ leave: useSignOut(), cache: useQueryClient(), at: usePlace() }),
    { wrapper: Scope },
  );

  act(() => {
    view.result.current.at.go({ account: 'profile' });
  });

  await waitFor(() => {
    expect(view.result.current.at.place.account).toBe('profile');
  });

  view.result.current.cache.setQueryData(['what', 'they', 'kept'], ['arrival']);

  return view;
};

beforeEach(() => {
  ended.mockReset();
  refresh.mockClear();
  vi.mocked(notify.failed).mockReset();
});

describe('useSignOut', () => {
  it('ends the session, forgets what was held for the person leaving, and goes home', async () => {
    ended.mockResolvedValue(true);

    const { result } = await drawOpenOnTheAccount();

    await act(async () => {
      await result.current.leave();
    });

    expect(result.current.cache.getQueryData(['what', 'they', 'kept'])).toBeUndefined();
    expect(result.current.at.place.account).toBeNull();
    expect(result.current.at.place.section).toBe('home');
    expect(refresh).toHaveBeenCalledOnce();
    expect(notify.failed).not.toHaveBeenCalled();
  });

  it('leaves everything as it was, and says so, when the server will not end the session', async () => {
    ended.mockResolvedValue(false);

    const { result } = await drawOpenOnTheAccount();

    await act(async () => {
      await result.current.leave();
    });

    expect(notify.failed).toHaveBeenCalledOnce();
    expect(result.current.cache.getQueryData(['what', 'they', 'kept'])).toEqual(['arrival']);
    expect(result.current.at.place.account).toBe('profile');
    expect(refresh).not.toHaveBeenCalled();
  });
});
