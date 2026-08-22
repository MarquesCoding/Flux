import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import {
  readCurrentProfile,
  writeCurrentProfile,
  profileHeaders,
  STORAGE_KEY,
} from './currentProfile';
import type { Platform } from '@ValenceClient/platform/Platform.types';

let platform: Platform = aFakePlatform();

beforeEach(() => {
  platform = aFakePlatform();
  installPlatform(platform);
});

afterEach(() => {
  forgetPlatform();
});

describe('readCurrentProfile', () => {
  it('says nobody has been chosen on a device nobody has chosen on', () => {
    expect(readCurrentProfile()).toBeNull();
  });

  it('reads back who was chosen', () => {
    writeCurrentProfile('abc');

    expect(readCurrentProfile()).toBe('abc');
  });
});

describe('writeCurrentProfile', () => {
  it('remembers on the device rather than on the account', () => {
    writeCurrentProfile('abc');

    expect(platform.store.read(STORAGE_KEY)).toBe('abc');
  });

  it('forgets when nobody is watching', () => {
    writeCurrentProfile('abc');
    writeCurrentProfile(null);

    expect(platform.store.read(STORAGE_KEY)).toBeNull();
  });
});

describe('profileHeaders', () => {
  it('says who is watching', () => {
    writeCurrentProfile('abc');

    expect(profileHeaders()).toEqual({ 'x-flux-profile': 'abc' });
  });

  it('says nothing when nobody has been chosen, rather than naming nobody', () => {
    expect(profileHeaders()).toEqual({});
  });

  it('says nothing where the device cannot remember, rather than failing', () => {
    installPlatform(
      aFakePlatform({ store: { read: () => null, write: () => {}, forget: () => {} } }),
    );

    expect(profileHeaders()).toEqual({});
  });
});
