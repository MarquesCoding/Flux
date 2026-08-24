import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import {
  forgetPlatform,
  installPlatform,
  platformInUse,
} from '@ValenceClient/platform/installPlatform';
import { STORAGE_KEY, chooseOffline, chosenOffline } from './chosenOffline';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
});

describe('chosenOffline', () => {
  it('starts as nobody having asked for anything', () => {
    expect(chosenOffline()).toBe(false);
  });

  it('remembers somebody asking to be offline', () => {
    chooseOffline(true);

    expect(chosenOffline()).toBe(true);
  });

  it('forgets it again rather than remembering a no', () => {
    chooseOffline(true);
    chooseOffline(false);

    expect([chosenOffline(), platformInUse().store.read(STORAGE_KEY)]).toEqual([false, null]);
  });

  it('keeps it on the device, so another machine is unaffected', () => {
    chooseOffline(true);

    installPlatform(aFakePlatform());

    expect(chosenOffline()).toBe(false);
  });
});
