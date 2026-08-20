import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileQueries } from './profileQueries';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const fetchProfiles = vi.fn<() => Promise<ViewerProfile[]>>();
const readCurrentProfile = vi.fn<() => string | null>();

vi.mock('@FluxClient/profiles/fetchProfiles', () => ({
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

const ask = async (): Promise<ViewerProfile | null> => {
  const { queryFn } = profileQueries.watching();

  if (typeof queryFn !== 'function') {
    throw new TypeError('The query has no function to run.');
  }

  return queryFn({
    queryKey: ['profiles', 'watching'],
    signal: new AbortController().signal,
    meta: undefined,
    client: new QueryClient(),
  });
};

beforeEach(() => {
  fetchProfiles.mockReset().mockResolvedValue([aProfile()]);
  readCurrentProfile.mockReset().mockReturnValue(null);
});

describe('profileQueries.watching', () => {
  it('picks out whoever this device says is watching', async () => {
    readCurrentProfile.mockReturnValue('profile-2');
    fetchProfiles.mockResolvedValue([aProfile(), aProfile({ id: 'profile-2', name: 'Ada' })]);

    expect((await ask())?.name).toBe('Ada');
  });

  it('falls back to the profile the server counts a request against when nobody was picked', async () => {
    fetchProfiles.mockResolvedValue([aProfile({ name: 'Default' }), aProfile({ id: 'profile-2' })]);

    expect((await ask())?.name).toBe('Default');
  });

  it('falls back the same way when the device names somebody no longer on the account', async () => {
    readCurrentProfile.mockReturnValue('long-gone');
    fetchProfiles.mockResolvedValue([aProfile({ name: 'Default' })]);

    expect((await ask())?.name).toBe('Default');
  });

  it('is nobody only when the account has nobody', async () => {
    fetchProfiles.mockResolvedValue([]);

    expect(await ask()).toBeNull();
  });
});
