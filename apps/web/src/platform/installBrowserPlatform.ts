import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { theBrowsersStore } from '@ValenceWeb/platform/browserStore';
import { describeThisBrowser } from '@ValenceWeb/platform/describeThisBrowser';
import { thisTabsId } from '@ValenceWeb/platform/thisTabsId';
import { openRealtimeSocket } from '@ValenceWeb/realtime/openRealtimeSocket';

/**
 * Tells the application it is running in a browser, which is the first thing that has to happen —
 * before anything reads a preference or says who is watching.
 */
const installBrowserPlatform = (): void => {
  installPlatform({
    store: theBrowsersStore(),
    describeThisClient: describeThisBrowser,
    thisClientId: thisTabsId,
    openSocket: openRealtimeSocket,
  });
};

export { installBrowserPlatform };
