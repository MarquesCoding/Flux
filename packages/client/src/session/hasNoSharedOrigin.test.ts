import { afterEach, describe, expect, it } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { hasNoSharedOrigin } from './hasNoSharedOrigin';

const watching = (server: string): void => {
  forgetPlatform();
  installPlatform({ ...aFakePlatform(), whereTheServerIs: () => server });
};

afterEach(() => {
  forgetPlatform();
});

describe('hasNoSharedOrigin', () => {
  it('says no of a browser, which was served by the Flux it talks to', () => {
    watching('');

    expect(hasNoSharedOrigin()).toBe(false);
  });

  it('says yes of a client that had to be told where its Flux is', () => {
    watching('https://flux.example.com');

    expect(hasNoSharedOrigin()).toBe(true);
  });
});
