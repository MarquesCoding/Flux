import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { theBrowsersStore } from '@ValenceWeb/platform/browserStore';
import { describeThisBrowser } from '@ValenceWeb/platform/describeThisBrowser';
import { noFilesAreKept } from '@ValenceClient/platform/noFilesAreKept';
import { thisTabsId } from '@ValenceWeb/platform/thisTabsId';
import { theBrowsersReach } from '@ValenceWeb/platform/theBrowsersReach';
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
    canKeepFiles: () => false,
    held: noFilesAreKept(),
    reachability: theBrowsersReach(),
    openSocket: openRealtimeSocket,
  });
};

export { installBrowserPlatform };
