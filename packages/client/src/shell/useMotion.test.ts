import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { chooseMotion } from '@ValenceClient/shell/motion';
import { useMotion } from './useMotion';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
});

describe('useMotion', () => {
  it('starts with what this device already remembers', () => {
    chooseMotion('reduced');

    const { result } = renderHook(() => useMotion());

    expect(result.current.motion).toBe('reduced');
  });

  it('follows the machine where nothing was chosen', () => {
    const { result } = renderHook(() => useMotion());

    expect(result.current.motion).toBe('system');
  });

  it('remembers what was chosen through it', () => {
    const { result } = renderHook(() => useMotion());

    act(() => {
      result.current.choose('full');
    });

    expect(result.current.motion).toBe('full');
  });

  it('catches up when the choice is changed somewhere else, so two controls agree', () => {
    const { result } = renderHook(() => useMotion());

    act(() => {
      chooseMotion('reduced');
    });

    expect(result.current.motion).toBe('reduced');
  });

  it('stops listening once nobody is drawing with it', () => {
    const { result, unmount } = renderHook(() => useMotion());

    unmount();

    act(() => {
      chooseMotion('reduced');
    });

    expect(result.current.motion).toBe('system');
  });
});
