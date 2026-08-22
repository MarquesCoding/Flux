import { renderHook } from '@testing-library/react';
import { AddressScope } from '@ValenceScreens/testing/AddressScope';
import type { RenderHookOptions, RenderHookResult } from '@testing-library/react';

/**
 * Runs a hook that reads or writes the address, inside a cache and a router of its own.
 *
 * The application's own helper mounts a cache and nothing else, because most of what it holds only
 * ever asks the server questions. A hook about where somebody is needs the web application's
 * addresses underneath it as well.
 *
 * @param use - The hook to run.
 * @param options - Anything else Testing Library takes.
 * @returns Whatever `renderHook` returns.
 */
const renderHookInAnAddress = <TResult, TProps>(
  use: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>,
): RenderHookResult<TResult, TProps> => renderHook(use, { wrapper: AddressScope, ...options });

export { renderHookInAnAddress };
