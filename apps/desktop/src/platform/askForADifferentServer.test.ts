import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform, installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';
import { rememberServerAddress, serverAddress } from '@FluxClient/session/serverAddress';
import { askForADifferentServer } from './askForADifferentServer';

const reload = vi.fn();

const aWindowWatchingAServer = (): void => {
  forgetPlatform();
  installPlatform(aFakePlatform());
  vi.stubGlobal('location', { reload });
};

afterEach(() => {
  forgetPlatform();
  vi.unstubAllGlobals();
  reload.mockClear();
});

describe('askForADifferentServer', () => {
  it('forgets the server, so this client asks again', () => {
    aWindowWatchingAServer();
    rememberServerAddress('https://flux.example.com');

    askForADifferentServer();

    expect(serverAddress()).toBeNull();
  });

  it('reloads the window, since what has to go is every answer that server gave too', () => {
    aWindowWatchingAServer();

    askForADifferentServer();

    expect(reload).toHaveBeenCalledOnce();
  });
});
