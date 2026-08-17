import { render } from '@testing-library/react';
import { CacheScope } from '@FluxWeb/testing/CacheScope';
import { shellContext } from '@FluxWeb/shell/shellContext';
import type { ReactElement } from 'react';
import type { RenderResult } from '@testing-library/react';
import type { Shell } from '@FluxWeb/shell/shell.types';

const NOBODY = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Operator',
  email: 'operator@flux.test',
  role: 'admin' as const,
  image: null,
  emailVerified: true,
};

/**
 * The shell a page sees when nothing in particular is going on: somebody is signed in, nothing has
 * been watched, nothing is known, and there is no watch party.
 *
 * @param instead - Whatever this test wants to be different.
 * @returns A whole shell.
 */
const aShell = (instead: Partial<Shell> = {}): Shell => ({
  title: 'Flux',
  user: NOBODY,
  watcher: null,
  household: [],
  known: new Map(),
  rememberItems: () => undefined,
  progress: new Map(),
  reportProgress: () => undefined,
  readProgress: () => Promise.resolve(),
  startOverride: null,
  setStartOverride: () => undefined,
  moodLights: [],
  setMoodLights: () => undefined,
  askingAbout: null,
  setAskingAbout: () => undefined,
  watchParty: {
    party: null,
    command: null,
    notice: null,
    refusal: null,
    passwordWanted: null,
    meConnectionId: null,
    referenceSeconds: null,
    waitingFor: [],
    jitterMs: 0,
    open: () => undefined,
    join: () => undefined,
    leave: () => undefined,
    send: () => undefined,
    report: () => undefined,
    setRole: () => undefined,
    remove: () => undefined,
    ask: () => undefined,
    setPassword: () => undefined,
    forgetNotice: () => undefined,
    stopAsking: () => undefined,
    loosen: () => undefined,
  },
  refresh: () => Promise.resolve(),
  ...instead,
});

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
    wrapper: CacheScope,
  });
};

export { renderInAShell, aShell };
