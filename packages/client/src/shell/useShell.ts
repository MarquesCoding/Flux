import { useContext } from 'react';
import { shellContext } from '@ValenceClient/shell/shellContext';
import type { Shell } from './shell.types';

/**
 * What the page it is called from shares with every other page.
 *
 * Throws where there is no shell above it, because a page rendered outside one is a routing mistake
 * rather than a state to render around.
 *
 * @returns The shell.
 */
const useShell = (): Shell => {
  const held = useContext(shellContext);

  if (held === null) {
    throw new Error('A page was rendered outside the application shell.');
  }

  return held;
};

export { useShell };
