import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAShell } from '@ValenceScreens/testing/renderInAShell';
import { signOut } from '@ValenceClient/session/auth';
import { notify } from '@ValenceUI/notify';
import { AccountDialog } from './AccountDialog';
import type * as Auth from '@ValenceClient/session/auth';
import type * as Notify from '@ValenceUI/notify';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

vi.mock('@ValenceScreens/components/AccountArea/AccountArea', () => ({
  AccountArea: () => <p>The panels</p>,
}));

const mayAdminister = vi.hoisted(() => vi.fn<() => boolean>());

vi.mock('@ValenceClient/session/useWhatIMayDo', () => ({
  useWhatIMayDo: () => ({ may: () => false, mayAdminister: mayAdminister() }),
}));

vi.mock('@ValenceClient/session/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof Auth>()),
  signOut: vi.fn(),
}));

vi.mock('@ValenceUI/notify', async (importOriginal) => {
  const original = await importOriginal<typeof Notify>();

  return { ...original, notify: { ...original.notify, failed: vi.fn() } };
});

const ended = vi.mocked(signOut);

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  showsWhatIamWatching: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fetchMock = vi.fn();

/**
 * Draws the dialog open on a panel, or shut.
 *
 * @param panel - Which panel the address names.
 * @returns What the dialog was told.
 */
const draw = (panel: string | null = 'profile') => {
  const told = { onPanel: vi.fn(), onClose: vi.fn() };

  renderInAShell(<AccountDialog panel={panel} {...told} />);

  return told;
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ profiles: [PROFILE] }) });
  vi.stubGlobal('fetch', fetchMock);
  ended.mockReset();
  mayAdminister.mockReset().mockReturnValue(false);
  vi.mocked(notify.failed).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountDialog', () => {
  it('is shut when the address names no panel', () => {
    draw(null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says whose account it is once, on one line at the head', async () => {
    draw();

    const heading = await screen.findByRole('heading', { name: 'Marques' });

    expect(heading).toHaveClass('text-base');
    expect(heading.parentElement).toHaveClass('items-baseline');
    expect(screen.getByText('operator@valence.test')).toBeInTheDocument();
  });

  it('draws the panels beneath its head', async () => {
    draw();

    expect(await screen.findByText('The panels')).toBeInTheDocument();
  });

  it('signs out when asked', async () => {
    const actor = userEvent.setup();

    ended.mockResolvedValue(true);
    draw();

    await actor.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(ended).toHaveBeenCalledOnce();
    });
    expect(notify.failed).not.toHaveBeenCalled();
  });

  it('says so when the server would not end the session', async () => {
    const actor = userEvent.setup();

    ended.mockResolvedValue(false);
    draw();

    await actor.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(notify.failed).toHaveBeenCalledOnce();
    });
  });

  it('closes when the close button is pressed', async () => {
    const actor = userEvent.setup();
    const told = draw();

    await actor.click(await screen.findByRole('button', { name: 'Close' }));

    expect(told.onClose).toHaveBeenCalled();
  });

  it('marks the account of somebody who may administer the server', async () => {
    mayAdminister.mockReturnValue(true);

    draw();

    expect(await screen.findByText('admin')).toBeInTheDocument();
  });

  it('does not mark a viewer as one, nor before the server has said', async () => {
    draw();

    expect(await screen.findByRole('heading', { name: 'Marques' })).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AccountDialog.displayName).toBe('AccountDialog');
  });
});
