import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import {
  readSoundPreference,
  saveSoundPreference,
  DEFAULT_SOUND_PREFERENCE,
  STORAGE_KEY,
} from './soundPreference';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
});

describe('readSoundPreference', () => {
  it('answers with muted when nothing has been chosen', () => {
    expect(readSoundPreference()).toBe(DEFAULT_SOUND_PREFERENCE);
    expect(DEFAULT_SOUND_PREFERENCE).toBe('muted');
  });

  it('reads back what was saved', () => {
    saveSoundPreference('audible');

    expect(readSoundPreference()).toBe('audible');
  });

  it('reads back a return to silence', () => {
    saveSoundPreference('audible');
    saveSoundPreference('muted');

    expect(readSoundPreference()).toBe('muted');
  });

  it('falls back to muted on a setting it does not recognise', () => {
    const platform = aFakePlatform();

    platform.store.write(STORAGE_KEY, 'loud');
    installPlatform(platform);

    expect(readSoundPreference()).toBe(DEFAULT_SOUND_PREFERENCE);
  });
});

describe('saveSoundPreference', () => {
  it('keeps the choice on the device rather than anywhere shared', () => {
    const platform = aFakePlatform();

    installPlatform(platform);
    saveSoundPreference('audible');

    expect(platform.store.read(STORAGE_KEY)).toBe('audible');
  });
});
