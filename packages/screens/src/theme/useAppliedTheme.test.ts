import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { chooseTheme } from '@ValenceClient/shell/theme';
import { useAppliedTheme } from './useAppliedTheme';

const THE_THEME = 'valence.theme';

const aClient = (chosen: string | null = null): void => {
  const platform = aFakePlatform();

  if (chosen !== null) {
    platform.store.write(THE_THEME, chosen);
  }

  installPlatform(platform);
};

afterEach(() => {
  forgetPlatform();
  delete document.documentElement.dataset['theme'];
});

describe('useAppliedTheme', () => {
  it('marks the document with what was chosen before this window opened', () => {
    aClient('light');

    renderHook(() => {
      useAppliedTheme();
    });

    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('marks nothing where the machine is being followed, which leaves it in charge', () => {
    aClient();

    renderHook(() => {
      useAppliedTheme();
    });

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('follows a change made while it is drawn, wherever it was made', () => {
    aClient('light');

    renderHook(() => {
      useAppliedTheme();
    });

    act(() => {
      chooseTheme('dark');
    });

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
