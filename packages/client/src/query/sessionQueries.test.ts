import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionQueries } from './sessionQueries';

const fetchSession = vi.hoisted(() => vi.fn());
const readVersion = vi.hoisted(() => vi.fn());
const fetchProfiles = vi.hoisted(() => vi.fn());
const fetchEveryone = vi.hoisted(() => vi.fn());
const fetchSetupStatus = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/session/auth', () => ({ fetchSession }));
vi.mock('@ValenceClient/session/readVersion', () => ({ readVersion }));
vi.mock('@ValenceClient/profiles/fetchProfiles', () => ({ fetchProfiles }));
vi.mock('@ValenceClient/profiles/fetchEveryone', () => ({ fetchEveryone }));
vi.mock('@ValenceClient/setup/fetchSetupStatus', () => ({ fetchSetupStatus }));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.clearAllMocks();

  fetchSession.mockResolvedValue({ id: 'somebody' });
  readVersion.mockResolvedValue('1.4.2');
  fetchProfiles.mockResolvedValue([{ id: 'face' }]);
  fetchEveryone.mockResolvedValue([{ id: 'anybody' }]);
  fetchSetupStatus.mockResolvedValue({ isComplete: true });
});

describe('sessionQueries', () => {
  it('asks whether the server has been set up', async () => {
    await expect(aCache().fetchQuery(sessionQueries.setup())).resolves.toEqual({
      isComplete: true,
    });
  });

  it('asks who is signed in', async () => {
    await expect(aCache().fetchQuery(sessionQueries.who())).resolves.toEqual({ id: 'somebody' });
  });

  it('asks what this build is', async () => {
    await expect(aCache().fetchQuery(sessionQueries.version())).resolves.toBe('1.4.2');
  });

  it('asks for the faces on this account and everybody who could sign in', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(sessionQueries.profiles())).resolves.toEqual([{ id: 'face' }]);
    await expect(cache.fetchQuery(sessionQueries.everyone())).resolves.toEqual([{ id: 'anybody' }]);
  });

  it('holds everything about a session under one key, so signing in throws the lot away', () => {
    expect(sessionQueries.who().queryKey.slice(0, 1)).toEqual(sessionQueries.key);
    expect(sessionQueries.profiles().queryKey.slice(0, 1)).toEqual(sessionQueries.key);
  });
});
