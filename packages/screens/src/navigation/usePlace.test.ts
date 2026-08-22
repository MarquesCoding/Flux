import { act, waitFor } from '@testing-library/react';
import { renderHookInAnAddress } from '@ValenceScreens/testing/renderHookInAnAddress';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlace } from './usePlace';

const addressNow = (): string => `${window.location.pathname}${window.location.search}`;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePlace', () => {
  it('starts wherever the address bar says', () => {
    window.history.replaceState(null, '', '/search?q=blade');

    const { result } = renderHookInAnAddress(() => usePlace());

    expect(result.current.place).toMatchObject({ section: 'search', search: 'blade' });
  });

  it('writes where somebody moved to into the address', async () => {
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.go({ section: 'admin' });
    });

    await waitFor(() => {
      expect(addressNow()).toBe('/admin');
    });
  });

  it('keeps what it was not told to change', async () => {
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.go({ section: 'search', search: 'blade' });
    });

    await waitFor(() => {
      expect(result.current.place.search).toBe('blade');
    });

    act(() => {
      result.current.go({ inspecting: 'abc' });
    });

    await waitFor(() => {
      expect(result.current.place).toMatchObject({ search: 'blade', inspecting: 'abc' });
    });
  });

  it('adds an entry to the history when somebody moves', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.go({ section: 'admin' });
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalled();
    });
  });

  it('replaces the entry when a place is only corrected, so typing is not a history', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.replace({ section: 'search', search: 'b' });
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });

    expect(push).not.toHaveBeenCalled();
  });

  it('does not record going where it already is', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.go({ section: 'home' });
    });

    expect(push).not.toHaveBeenCalled();
  });

  it('follows the back button', async () => {
    const { result } = renderHookInAnAddress(() => usePlace());

    act(() => {
      result.current.go({ section: 'films' });
    });

    await waitFor(() => {
      expect(result.current.place.section).toBe('films');
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(result.current.place.section).toBe('home');
    });
  });
});
