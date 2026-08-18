import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminQueries } from './adminQueries';

const answered = vi.hoisted(() => (value: object) => vi.fn().mockResolvedValue(value));

const admin = vi.hoisted(() => ({
  fetchAdminOverview: vi.fn(),
  fetchRunningScans: vi.fn(),
  fetchMonitor: vi.fn(),
  fetchActiveSessions: vi.fn(),
  fetchJobDefinitions: vi.fn(),
  fetchJobSchedules: vi.fn(),
}));

const roles = vi.hoisted(() => ({
  fetchRoles: vi.fn(),
  fetchPermissionCatalogue: vi.fn(),
  fetchAccountPermissions: vi.fn(),
}));

const webhooks = vi.hoisted(() => ({ fetchWebhooks: vi.fn(), fetchWebhookDeliveries: vi.fn() }));
const fetchAccounts = vi.hoisted(() => vi.fn());
const readWholeLibrary = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/admin/fetchAdmin', () => admin);
vi.mock('@FluxWeb/admin/fetchRoles', () => roles);
vi.mock('@FluxWeb/admin/fetchWebhooks', () => webhooks);
vi.mock('@FluxWeb/admin/fetchAccounts', () => ({ fetchAccounts }));
vi.mock('@FluxWeb/library/readWholeLibrary', () => ({ readWholeLibrary }));

const aCache = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const aThing = (id: string, seriesTitle: string | null = null) => ({ id, seriesTitle });

beforeEach(() => {
  vi.clearAllMocks();

  for (const [name, said] of Object.entries({
    fetchAdminOverview: { transcoder: {} },
    fetchRunningScans: [],
    fetchMonitor: { resources: {} },
    fetchActiveSessions: [],
    fetchJobDefinitions: [],
    fetchJobSchedules: [],
  })) {
    Object.assign(admin, { [name]: answered(said) });
  }

  Object.assign(roles, {
    fetchRoles: answered([]),
    fetchPermissionCatalogue: answered([]),
    fetchAccountPermissions: answered({ roles: [] }),
  });

  Object.assign(webhooks, {
    fetchWebhooks: answered([]),
    fetchWebhookDeliveries: answered([]),
  });

  fetchAccounts.mockResolvedValue([]);
  readWholeLibrary.mockResolvedValue([aThing('one')]);
});

describe('adminQueries', () => {
  it('reads everything the server has to say about itself', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(adminQueries.overview())).resolves.toEqual({ transcoder: {} });
    await expect(cache.fetchQuery(adminQueries.monitor())).resolves.toEqual({ resources: {} });
    await expect(cache.fetchQuery(adminQueries.sessions())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.jobs())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.schedules())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.accounts())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.roles())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.permissions())).resolves.toEqual([]);
    await expect(cache.fetchQuery(adminQueries.webhooks())).resolves.toEqual([]);
  });

  it('watches a scan on a timer, since a scan finishes without announcing it', () => {
    expect(adminQueries.scans().refetchInterval).toBeGreaterThan(0);
  });

  it('reads a running scan', async () => {
    await expect(aCache().fetchQuery(adminQueries.scans())).resolves.toEqual([]);
  });

  it('asks nothing about nobody and nothing', () => {
    expect(adminQueries.accountPermissions(null).enabled).toBe(false);
    expect(adminQueries.deliveries(null).enabled).toBe(false);
    expect(adminQueries.everything([]).enabled).toBe(false);
  });

  it('reads what one account may do, and how one webhook has been getting on', async () => {
    const cache = aCache();

    await expect(cache.fetchQuery(adminQueries.accountPermissions('somebody'))).resolves.toEqual({
      roles: [],
    });

    await expect(cache.fetchQuery(adminQueries.deliveries('hook'))).resolves.toEqual([]);
  });

  it('lists everything on the server once per thing rather than once per file', async () => {
    readWholeLibrary.mockResolvedValue([
      aThing('ted-s01e01', 'Ted'),
      aThing('ted-s01e02', 'Ted'),
      aThing('arrival'),
    ]);

    await expect(aCache().fetchQuery(adminQueries.everything(['films']))).resolves.toEqual([
      aThing('ted-s01e01', 'Ted'),
      aThing('arrival'),
    ]);
  });
});
