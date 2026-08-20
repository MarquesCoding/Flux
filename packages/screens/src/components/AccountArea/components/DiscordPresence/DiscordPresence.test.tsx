import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordPresence } from './DiscordPresence';
import type { Avatar, ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type SaveProfile = (
  profileId: string,
  name: string,
  colour: ProfileColour,
  avatar?: Avatar,
  askStillWatchingAfter?: number,
  showsWhatIamWatching?: boolean,
) => Promise<boolean>;

const saveProfile = vi.fn<SaveProfile>();
const fetchProfiles = vi.fn<() => Promise<ViewerProfile[]>>();
const readCurrentProfile = vi.fn<() => string | null>();

vi.mock('@FluxClient/profiles/fetchProfiles', () => ({
  saveProfile: (...args: Parameters<SaveProfile>) => saveProfile(...args),
  fetchProfiles: () => fetchProfiles(),
}));

vi.mock('@FluxClient/profiles/currentProfile', () => ({
  readCurrentProfile: () => readCurrentProfile(),
}));

const aProfile = (overrides: Partial<ViewerProfile> = {}): ViewerProfile => ({
  id: 'profile-1',
  name: 'Marques',
  colour: '#8b5ce8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 3,
  showsWhatIamWatching: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

const draw = (onChanged: () => void = () => {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <DiscordPresence onChanged={onChanged} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  saveProfile.mockReset().mockResolvedValue(true);
  fetchProfiles.mockReset().mockResolvedValue([aProfile()]);
  readCurrentProfile.mockReset().mockReturnValue('profile-1');
});

describe('DiscordPresence', () => {
  it('stands where somebody looking at their own account will see it, rather than behind an edit', () => {
    draw();

    expect(screen.getByRole('switch', { name: /discord/i })).toBeInTheDocument();
  });

  it('shows the setting as it stands', async () => {
    fetchProfiles.mockResolvedValue([aProfile({ showsWhatIamWatching: true })]);

    draw();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeChecked();
    });
  });

  it('writes the moment it is flipped, since there is nothing to save alongside it', async () => {
    const onChanged = vi.fn();

    draw(onChanged);

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeEnabled();
    });

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledWith(
        'profile-1',
        'Marques',
        '#8b5ce8',
        { kind: 'initial' },
        3,
        true,
      );
    });

    expect(onChanged).toHaveBeenCalled();
  });

  it('changes the profile that is watching, not whichever the account lists first', async () => {
    readCurrentProfile.mockReturnValue('profile-2');
    fetchProfiles.mockResolvedValue([
      aProfile(),
      aProfile({ id: 'profile-2', name: 'Ada', colour: '#3ac47d' }),
    ]);

    draw();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeEnabled();
    });

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalled();
    });

    expect(saveProfile.mock.calls[0]?.[0]).toBe('profile-2');
    expect(saveProfile.mock.calls[0]?.[1]).toBe('Ada');
  });

  it('puts the switch back and says so when the write is refused', async () => {
    saveProfile.mockResolvedValue(false);

    draw();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeEnabled();
    });

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByText(/could not be saved/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('changes the profile the server counts playback against when nobody was picked', async () => {
    readCurrentProfile.mockReturnValue(null);
    fetchProfiles.mockResolvedValue([
      aProfile({ id: 'profile-1', name: 'Default' }),
      aProfile({ id: 'profile-2', name: 'Ada' }),
    ]);

    draw();

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeEnabled();
    });

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalled();
    });

    expect(saveProfile.mock.calls[0]?.[0]).toBe('profile-1');
  });

  it('cannot be flipped while the account has nobody on it at all', async () => {
    fetchProfiles.mockResolvedValue([]);

    draw();

    await userEvent.click(screen.getByRole('switch'));

    expect(saveProfile).not.toHaveBeenCalled();
  });
});
