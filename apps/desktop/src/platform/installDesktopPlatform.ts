import { installPlatform } from '@FluxClient/platform/installPlatform';
import { theDesktopsStore } from '@FluxDesktop/platform/theDesktopsStore';
import { describeThisDesktop } from '@FluxDesktop/platform/describeThisDesktop';
import { thisWindowsId } from '@FluxDesktop/platform/thisWindowsId';
import { theDesktopsSocket } from '@FluxDesktop/platform/theDesktopsSocket';

/**
 * Tells the application what it is running on, when what it is running on is this client.
 *
 * Four answers, which is all a host is. Preferences go to a file the window's own process keeps,
 * rather than to web storage, because this client has no origin to hang storage off and would forget
 * which server it watches every time it was rebuilt. The rest is the same shape a browser fills in.
 */
const installDesktopPlatform = (): void => {
  installPlatform({
    store: theDesktopsStore(),
    describeThisClient: () => describeThisDesktop(navigator.userAgent),
    thisClientId: thisWindowsId,
    openSocket: theDesktopsSocket,
  });
};

export { installDesktopPlatform };
