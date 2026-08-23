import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { STORAGE_KEY, readLastLibrary, rememberLastLibrary } from './lastLibrary';
import type { Platform } from '@ValenceClient/platform/Platform.types';

const held = new Map<string, string>();

const aPlatform = (): Platform => ({
  store: {
    read: (key) => held.get(key) ?? null,
    write: (key, value) => {
      held.set(key, value);
    },
    forget: (key) => {
      held.delete(key);
    },
  },
  describeThisClient: () => 'a test',
  thisClientId: () => 'a-client',
  canKeepFiles: () => true,
  openSocket: vi.fn(),
});

afterEach(() => {
  held.clear();
});

describe('lastLibrary', () => {
  it('remembers which library was being looked at', () => {
    installPlatform(aPlatform());

    rememberLastLibrary('a-library');

    expect(readLastLibrary()).toBe('a-library');
  });

  it('reads nothing where nobody has chosen one on this device', () => {
    installPlatform(aPlatform());

    expect(readLastLibrary()).toBeNull();
  });

  it('keeps it where the rest of this device own choices are kept', () => {
    installPlatform(aPlatform());

    rememberLastLibrary('a-library');

    expect(held.get(STORAGE_KEY)).toBe('a-library');
  });
});
