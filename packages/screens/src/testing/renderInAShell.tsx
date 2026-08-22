import { render } from '@testing-library/react';
import { AddressScope } from '@ValenceScreens/testing/AddressScope';
import { shellContext } from '@ValenceClient/shell/shellContext';
import { aShell } from '@ValenceClient/testing/aShell';
import type { ReactElement } from 'react';
import type { RenderResult } from '@testing-library/react';
import type { Shell } from '@ValenceClient/shell/shell.types';

/**
 * Renders a page inside a shell, which is the only place a page can be rendered: it reads who is
 * watching and what has been seen from the one above it.
 *
 * @param ui - The page.
 * @param shell - Whatever this test wants the shell to say.
 * @returns Whatever `render` returns.
 */
const renderInAShell = (ui: ReactElement, shell: Partial<Shell> = {}): RenderResult => {
  const held = aShell(shell);

  return render(<shellContext.Provider value={held}>{ui}</shellContext.Provider>, {
    wrapper: AddressScope,
  });
};

export { renderInAShell };
