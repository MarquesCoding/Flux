import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { forgetPlatform } from './src/platform/installPlatform';

afterEach(() => {
  cleanup();
  forgetPlatform();
});
