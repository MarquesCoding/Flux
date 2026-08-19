import { installPlatform } from '@FluxClient/platform/installPlatform';
import { aFakePlatform } from '@FluxClient/testing/aFakePlatform';

/**
 * Tells the application it is running on a client, before anything asks it what kind.
 *
 * A screen is written against the ports rather than against a browser, so the tests give it the
 * in-memory client rather than a real one. Fresh each time, because the store outlives the component
 * that wrote to it and a preference kept by one test is not a preference the next one set.
 */
const installATestClient = (): void => {
  installPlatform(aFakePlatform());
};

export { installATestClient };
