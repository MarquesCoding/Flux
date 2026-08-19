import { installPlatform } from '@FluxClient/platform/installPlatform';
import { theBrowsersStore } from '@FluxWeb/platform/browserStore';
import { describeThisBrowser } from '@FluxWeb/platform/describeThisBrowser';
import { thisTabsId } from '@FluxWeb/platform/thisTabsId';
import { openRealtimeSocket } from '@FluxWeb/realtime/openRealtimeSocket';

/**
 * Tells the application it is running in a browser, which is the first thing that has to happen —
 * before anything reads a preference or says who is watching.
 */
const installBrowserPlatform = (): void => {
  installPlatform({
    store: theBrowsersStore(),
    describeThisClient: describeThisBrowser,
    whereTheServerIs: () => '',
    signInElsewhere: null,
    thisClientId: thisTabsId,
    openSocket: openRealtimeSocket,
  });
};

export { installBrowserPlatform };
