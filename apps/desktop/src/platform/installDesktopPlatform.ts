import { installPlatform } from '@FluxClient/platform/installPlatform';
import { serverAddress } from '@FluxClient/session/serverAddress';
import { theDesktopsStore } from '@FluxDesktop/platform/theDesktopsStore';
import { describeThisDesktop } from '@FluxDesktop/platform/describeThisDesktop';
import { thisWindowsId } from '@FluxDesktop/platform/thisWindowsId';
import { openRealtimeSocket } from '@FluxDesktop/realtime/openRealtimeSocket';

/**
 * Tells the application it is running on a desktop client, which is the first thing that has to
 * happen — before anything reads a preference, says who is watching, or asks where the server is.
 *
 * Installed before the address is known rather than after. The store is what holds the address, so
 * something has to be able to read it before there is anything to read, and `whereTheServerIs`
 * answers with nothing until somebody has said.
 */
const installDesktopPlatform = (): void => {
  installPlatform({
    store: theDesktopsStore(),
    describeThisClient: () => describeThisDesktop(navigator.userAgent),
    thisClientId: thisWindowsId,
    whereTheServerIs: () => serverAddress() ?? '',
    openSocket: openRealtimeSocket,
  });
};

export { installDesktopPlatform };
