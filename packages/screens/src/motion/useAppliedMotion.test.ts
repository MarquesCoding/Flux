import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { chooseMotion } from '@ValenceClient/shell/motion';
import { useAppliedMotion } from './useAppliedMotion';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
  delete document.documentElement.dataset['motion'];
});

describe('useAppliedMotion', () => {
  it('marks the document with a choice to be still', () => {
    chooseMotion('reduced');

    renderHook(() => useAppliedMotion());

    expect(document.documentElement.dataset['motion']).toBe('reduced');
  });

  it('leaves the document unmarked where the machine is being followed', () => {
    renderHook(() => useAppliedMotion());

    expect(document.documentElement.dataset['motion']).toBeUndefined();
  });

  it('tells motion to still everything where stillness was asked for', () => {
    chooseMotion('reduced');

    const { result } = renderHook(() => useAppliedMotion());

    expect(result.current).toBe('always');
  });

  it('tells motion to ignore the machine where movement was asked for', () => {
    chooseMotion('full');

    const { result } = renderHook(() => useAppliedMotion());

    expect(result.current).toBe('never');
  });

  it('leaves motion reading the machine where nobody has overruled it', () => {
    const { result } = renderHook(() => useAppliedMotion());

    expect(result.current).toBe('user');
  });

  it('follows a change made while it is drawn', () => {
    const { result } = renderHook(() => useAppliedMotion());

    act(() => {
      chooseMotion('reduced');
    });

    expect(result.current).toBe('always');
    expect(document.documentElement.dataset['motion']).toBe('reduced');
  });
});
