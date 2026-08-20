import { installPlatform } from '@FluxClient/platform/installPlatform';
import { theDesktopsStore } from '@FluxDesktop/platform/theDesktopsStore';
import { describeThisDesktop } from '@FluxDesktop/platform/describeThisDesktop';
import { thisWindowsId } from '@FluxDesktop/platform/thisWindowsId';

/**
 * Tells the one screen this client ships what it is running on.
 *
 * It is a small platform because it is a small screen: somebody names their Flux, it is written
 * down, and the window opens on that server. Everything after that is the server's own application,
 * running on the server's own origin, and it installs the platform a browser installs — because
 * from there on this window is a browser.
 *
 * So there is no socket to open and no server to point requests at. This page asks nothing of Flux
 * except whether it answered.
 */
const installDesktopPlatform = (): void => {
  installPlatform({
    store: theDesktopsStore(),
    describeThisClient: () => describeThisDesktop(navigator.userAgent),
    thisClientId: thisWindowsId,
    openSocket: () => ({ send: () => {}, close: () => {} }),
  });
};

export { installDesktopPlatform };
