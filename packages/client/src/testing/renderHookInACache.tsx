import { renderHook } from '@testing-library/react';
import { CacheScope } from '@FluxClient/testing/CacheScope';
import type { RenderHookOptions, RenderHookResult } from '@testing-library/react';

/**
 * Runs a hook that asks the cache questions, inside a cache of its own.
 *
 * @param use - The hook to run.
 * @param options - Anything else Testing Library takes.
 * @returns Whatever `renderHook` returns.
 */
const renderHookInACache = <TResult, TProps>(
  use: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>,
): RenderHookResult<TResult, TProps> => renderHook(use, { wrapper: CacheScope, ...options });

export { renderHookInACache };
