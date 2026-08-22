import { useState } from 'react';
import { RouterContextProvider } from '@tanstack/react-router';
import { CacheScope } from '@ValenceClient/testing/CacheScope';
import { buildRouter } from '@ValenceScreens/routes/buildRouter';
import type { AddressScopeProps } from './AddressScope.types';

/**
 * Holds a cache and a router for whatever is rendered inside it, both made fresh each time.
 *
 * The cache half is the application's and lives with it. The router is the web application's own:
 * it is given the same addresses this client serves and the browser's history, so a test that puts
 * something in the address bar before rendering is read exactly as a reload would read it. It holds
 * the router rather than drawing through it, because what a test renders is what it asked for
 * rather than whatever the address matched.
 *
 * @param children - What is being tested.
 */
const AddressScope = ({ children }: AddressScopeProps) => {
  const [router] = useState(() => buildRouter());

  return (
    <CacheScope>
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </CacheScope>
  );
};

AddressScope.displayName = 'AddressScope';

export { AddressScope };
