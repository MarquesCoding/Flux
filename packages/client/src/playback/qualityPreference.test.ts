import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import {
  readQualityPreference,
  saveQualityPreference,
  DEFAULT_QUALITY_PREFERENCE,
  STORAGE_KEY,
} from './qualityPreference';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetPlatform();
});

describe('readQualityPreference', () => {
  it('answers with Original when nothing has been chosen', () => {
    expect(readQualityPreference()).toBe(DEFAULT_QUALITY_PREFERENCE);
  });

  it('reads back what was saved', () => {
    saveQualityPreference('720p');

    expect(readQualityPreference()).toBe('720p');
  });

  it('falls back to Original on a stale setting', () => {
    const platform = aFakePlatform();

    platform.store.write(STORAGE_KEY, '8k');
    installPlatform(platform);

    expect(readQualityPreference()).toBe(DEFAULT_QUALITY_PREFERENCE);
  });
});

describe('saveQualityPreference', () => {
  it('writes the choice where this client keeps what belongs to the device', () => {
    const platform = aFakePlatform();

    installPlatform(platform);
    saveQualityPreference('480p');

    expect(platform.store.read(STORAGE_KEY)).toBe('480p');
  });

  it('leaves a client that cannot remember to say so, rather than guarding it here', () => {
    installPlatform(
      aFakePlatform({
        store: {
          read: () => null,
          write: () => {
            throw new Error('Storage is full.');
          },
          forget: () => {},
        },
      }),
    );

    expect(() => {
      saveQualityPreference('480p');
    }).toThrow('Storage is full.');
  });
});
