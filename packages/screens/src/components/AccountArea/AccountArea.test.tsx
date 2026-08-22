import { screen } from '@testing-library/react';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '@ValenceUI/Tabs';
import { AccountArea } from './AccountArea';
import type { SessionUser } from '@ValenceContracts/schemas/Session';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

const USER: SessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  email: 'marques@valence.local',
  emailVerified: true,
  role: 'admin',
  twoFactorEnabled: false,
};

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
 * Draws the panels on the tab the caller names, standing in for the dialog that normally holds
 * which one is open.
 *
 * @param panel - The panel to show.
 * @param handlers - What to tell about a change.
 * @returns What was rendered.
 */
const drawOn = (panel: string, handlers: { onChanged?: () => void } = {}) =>
  renderInAnAddress(
    <Tabs value={panel} onValueChange={() => {}}>
      <AccountArea
        user={USER}
        panel={panel}
        profile={PROFILE}
        draft={{
          name: PROFILE.name,
          colour: PROFILE.colour,
          avatar: PROFILE.avatar,
          askStillWatchingAfter: PROFILE.askStillWatchingAfter,
          showsWhatIamWatching: PROFILE.showsWhatIamWatching,
          photo: null,
        }}
        onDraft={vi.fn()}
        onChanged={handlers.onChanged ?? vi.fn()}
      />
    </Tabs>,
  );

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ profiles: [PROFILE] }),
  });

  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn() });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AccountArea', () => {
  it('shows how somebody appears on the panel about appearing', () => {
    drawOn('profile');

    expect(screen.getByText('Profile picture')).toBeInTheDocument();
    expect(screen.getByText('Colour')).toBeInTheDocument();
  });

  it('keeps how somebody appears apart from how they get in', () => {
    const { unmount } = drawOn('profile');

    expect(screen.getByText('Profile picture')).toBeInTheDocument();
    expect(screen.queryByText('Two-step sign in')).not.toBeInTheDocument();

    unmount();

    drawOn('security');

    expect(screen.getByText('Two-step sign in')).toBeInTheDocument();
    expect(screen.queryByText('Profile picture')).not.toBeInTheDocument();
  });

  it('changes how somebody appears where they stand, rather than in a dialog of its own', () => {
    drawOn('profile');

    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change/ })).not.toBeInTheDocument();
  });

  it('says nothing about saving, since the dialog around it holds the one button that does', () => {
    drawOn('profile');

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AccountArea.displayName).toBe('AccountArea');
  });
});
