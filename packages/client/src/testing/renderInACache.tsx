import { render } from '@testing-library/react';
import { CacheScope } from '@ValenceClient/testing/CacheScope';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';

/**
 * Renders something that asks the cache questions, inside a cache of its own.
 *
 * @param ui - What to render.
 * @param options - Anything else Testing Library takes.
 * @returns Whatever `render` returns.
 */
const renderInACache = (ui: ReactElement, options?: RenderOptions): RenderResult =>
  render(ui, { wrapper: CacheScope, ...options });

export { renderInACache };
