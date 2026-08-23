import { afterEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { canKeepFiles } from './canKeepFiles';

afterEach(() => {
  forgetPlatform();
});

describe('canKeepFiles', () => {
  it('takes the client at its word when it says it can', () => {
    installPlatform(aFakePlatform({ canKeepFiles: () => true }));

    expect(canKeepFiles()).toBe(true);
  });

  it('takes the client at its word when it says it cannot, as a browser does', () => {
    installPlatform(aFakePlatform({ canKeepFiles: () => false }));

    expect(canKeepFiles()).toBe(false);
  });
});
