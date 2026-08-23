import { installPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import type { Platform } from '@ValenceClient/platform/Platform.types';

/**
 * Tells the application it is running on a client, before anything asks it what kind.
 *
 * A screen is written against the ports rather than against a browser, so the tests give it the
 * in-memory client rather than a real one. Fresh each time, because the store outlives the component
 * that wrote to it and a preference kept by one test is not a preference the next one set.
 *
 * @param overrides - Anything a particular test wants this client to answer differently — what it
 * is holding on disk, or whether it can reach the server at all.
 */
const installATestClient = (overrides: Partial<Platform> = {}): void => {
  installPlatform(aFakePlatform(overrides));
};

export { installATestClient };
