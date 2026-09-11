import { queryOptions } from '@tanstack/react-query';
import {
  fetchAdminOverview,
  fetchRunningScans,
  fetchMonitor,
  fetchActiveSessions,
  fetchJobDefinitions,
  fetchJobSchedules,
} from '@ValenceClient/admin/fetchAdmin';
import { fetchAccounts } from '@ValenceClient/admin/fetchAccounts';
import { fetchFolders } from '@ValenceClient/admin/fetchFolders';
import {
  fetchRoles,
  fetchPermissionCatalogue,
  fetchAccountPermissions,
} from '@ValenceClient/admin/fetchRoles';
import { fetchWebhooks, fetchWebhookDeliveries } from '@ValenceClient/admin/fetchWebhooks';
import { fetchEverybodysShares } from '@ValenceClient/sharing/fetchShares';
import { readWholeLibrary } from '@ValenceClient/library/readWholeLibrary';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';

const ADMIN = ['admin'] as const;

const WATCHED_EVERY_MS = 5000;

/**
 * What the server is doing at a glance.
 *
 * @returns The query.
 */
const overview = () =>
  queryOptions({
    queryKey: [...ADMIN, 'overview'],
    queryFn: () => fetchAdminOverview(),
  });

/**
 * Any scan under way, asked for repeatedly because a scan finishes without announcing it.
 *
 * @returns The query.
 */
const scans = () =>
  queryOptions({
    queryKey: [...ADMIN, 'scans'],
    queryFn: () => fetchRunningScans(),
    refetchInterval: WATCHED_EVERY_MS,
  });

/**
 * What the transcoder is doing.
 *
 * @returns The query.
 */
const monitor = () =>
  queryOptions({
    queryKey: [...ADMIN, 'monitor'],
    queryFn: () => fetchMonitor(),
  });

/**
 * Who is watching now.
 *
 * @returns The query.
 */
const sessions = () =>
  queryOptions({
    queryKey: [...ADMIN, 'sessions'],
    queryFn: () => fetchActiveSessions(),
  });

/**
 * The jobs this server knows how to run.
 *
 * @returns The query.
 */
const jobs = () =>
  queryOptions({
    queryKey: [...ADMIN, 'jobs'],
    queryFn: () => fetchJobDefinitions(),
  });

/**
 * When those jobs are set to run, and the clock the server runs them on.
 *
 * The timezone travels with the schedule because it is a property of the schedule: a trigger that
 * says 03:00 says nothing until you know whose 03:00 it is.
 *
 * @returns The query.
 */
const schedules = () =>
  queryOptions({
    queryKey: [...ADMIN, 'schedules'],
    queryFn: () => fetchJobSchedules(),
  });

/**
 * The accounts on this server.
 *
 * @returns The query.
 */
const accounts = () =>
  queryOptions({
    queryKey: [...ADMIN, 'accounts'],
    queryFn: () => fetchAccounts(),
  });

/**
 * The roles, and what each of them may do.
 *
 * @returns The query.
 */
const roles = () =>
  queryOptions({
    queryKey: [...ADMIN, 'roles'],
    queryFn: () => fetchRoles(),
  });

/**
 * Every permission there is, which is what a role is assembled from.
 *
 * @returns The query.
 */
const permissions = () =>
  queryOptions({
    queryKey: [...ADMIN, 'permissions'],
    queryFn: () => fetchPermissionCatalogue(),
  });

/**
 * What one account may do, roles and overrides together.
 *
 * @param accountId - Whose, or null where nobody is open.
 * @returns The query.
 */
const accountPermissions = (accountId: string | null) =>
  queryOptions({
    queryKey: [...ADMIN, 'accountPermissions', accountId],
    queryFn: () => fetchAccountPermissions(accountId ?? ''),
    enabled: accountId !== null,
  });

/**
 * The webhooks this server will call.
 *
 * @returns The query.
 */
const webhooks = () =>
  queryOptions({
    queryKey: [...ADMIN, 'webhooks'],
    queryFn: () => fetchWebhooks(),
  });

/**
 * What happened the last times one was called.
 *
 * @param webhookId - Which webhook, or null where none is open.
 * @returns The query.
 */
const deliveries = (webhookId: string | null) =>
  queryOptions({
    queryKey: [...ADMIN, 'deliveries', webhookId],
    queryFn: () => fetchWebhookDeliveries(webhookId ?? ''),
    enabled: webhookId !== null,
  });

/**
 * Everything on the server, one entry per thing rather than per file, which is what the media panel
 * lists and what a correction is started from.
 *
 * @param libraryIds - The libraries to read, which is all of them.
 * @returns The query.
 */
const everything = (libraryIds: readonly string[]) =>
  queryOptions({
    queryKey: [...ADMIN, 'everything', [...libraryIds].sort()],
    queryFn: async () => {
      const shelves = await Promise.all(libraryIds.map((id) => readWholeLibrary(id)));
      const byThing = new Map<string, MediaSummary>();

      for (const item of shelves.flat()) {
        const key = item.seriesTitle ?? item.id;

        if (!byThing.has(key)) {
          byThing.set(key, item);
        }
      }

      return [...byThing.values()];
    },
    enabled: libraryIds.length > 0,
  });

/**
 * Every link this server has handed out, and who handed each one out.
 *
 * @returns The query.
 */
const shares = () =>
  queryOptions({
    queryKey: [...ADMIN, 'shares'],
    queryFn: () => fetchEverybodysShares(),
  });

/**
 * The folders inside one on the machine running Valence, for choosing where a library lives. Not
 * retried: a folder that is not there is an answer, and asking three more times only delays it.
 *
 * @param path - The folder, or nothing for the places to start from.
 * @returns The query.
 */
const folders = (path: string | null) =>
  queryOptions({
    queryKey: [...ADMIN, 'folders', path],
    queryFn: () => fetchFolders(path),
    retry: false,
  });

const adminQueries = {
  folders,
  overview,
  scans,
  monitor,
  sessions,
  jobs,
  schedules,
  accounts,
  roles,
  permissions,
  accountPermissions,
  webhooks,
  deliveries,
  everything,
  shares,
  key: ADMIN,
};

export { adminQueries };
