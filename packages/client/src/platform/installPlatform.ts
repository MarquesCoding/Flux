import { carryOldKeysOver } from '@ValenceClient/platform/carryOldKeysOver';
import type { Platform } from '@ValenceClient/platform/Platform.types';

let installed: Platform | null = null;

/**
 * Tells the application what it is running on, which is the one thing it cannot work out for itself.
 *
 * Everything else in this package is the same on every client: what the server is asked, what the
 * answers mean, what is worth caching. What differs is where a preference is kept and what this
 * machine is called — a browser has `localStorage` and a user agent, a desktop application has a
 * file and an operating system that will say its own name. So the host supplies those on the way up
 * and nothing below has to know which host it was.
 *
 * It is installed once rather than passed down, because the code that needs it is plain functions
 * rather than components — a reader called from a query has no context to reach into. A test
 * installs whatever it wants to pretend to be.
 *
 * Installing is also the moment anything this device already remembers is carried to the names it is
 * remembered under now. It happens here because here is the first point at which there is a store to
 * read, and it is before anything has asked it a question — a preference read before its value had
 * been carried across would read as absent, and absent means the default.
 *
 * @param platform - What this client can do.
 */
const installPlatform = (platform: Platform): void => {
  installed = platform;

  carryOldKeysOver(platform.store);
};

/**
 * What the application is running on.
 *
 * Throws where nothing was installed. That is deliberate and it is the whole value of doing it this
 * way: a client that forgets to say what it is fails at once and says so, rather than quietly
 * behaving as though nobody is watching and no preference was ever chosen.
 *
 * @returns The platform this client installed.
 */
const platformInUse = (): Platform => {
  if (installed === null) {
    throw new Error('No platform was installed. A client must call installPlatform on the way up.');
  }

  return installed;
};

/**
 * Forgets the installed platform, so that one test cannot be answered by another test's.
 */
const forgetPlatform = (): void => {
  installed = null;
};

export { installPlatform, platformInUse, forgetPlatform };
