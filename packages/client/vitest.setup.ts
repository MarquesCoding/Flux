import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { forgetPlatform, installPlatform } from './src/platform/installPlatform';
import { aFakePlatform } from './src/testing/aFakePlatform';

/**
 * Tells the application it is running on a client, before anything asks it where its server is.
 *
 * Reading anything asks the platform for the device store, and `platformInUse` throws where nothing has been
 * installed — deliberately, so a client that forgets to say what it is fails at once. A test is a
 * client like any other, and one that has not said so is testing the wrong thing.
 */
const installATestClient = (): void => {
  installPlatform(aFakePlatform());
};

beforeEach(installATestClient);

afterEach(() => {
  cleanup();
  forgetPlatform();
});
