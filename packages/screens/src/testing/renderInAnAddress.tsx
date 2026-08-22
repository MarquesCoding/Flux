import { render } from '@testing-library/react';
import { AddressScope } from '@ValenceScreens/testing/AddressScope';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Renders something from the web application, inside a cache and a router of its own.
 *
 * Anything drawn here may read the address — a card that opens a dialog by changing it, a panel
 * that knows which section it is in — so the router is mounted whether or not this particular
 * component asks for it. The application's own helper mounts a cache alone, which is all its
 * readers and hooks need.
 *
 * @param ui - What to render.
 * @param options - Anything else Testing Library takes.
 * @returns Whatever `render` returns.
 */
const renderInAnAddress = (ui: ReactElement, options?: RenderOptions): RenderResult =>
  render(ui, { wrapper: AddressScope, ...options });

export { renderInAnAddress };
