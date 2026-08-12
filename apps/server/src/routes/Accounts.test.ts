import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '@FluxServer/App';
import { createMemoryAuth } from '@FluxServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@FluxServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@FluxServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@FluxServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@FluxServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@FluxServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@FluxServer/favourites/createMemoryFavouriteService';
import { createMemorySegmentService } from '@FluxServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@FluxServer/subtitles/createMemorySubtitleService';
import type { Permission } from '@FluxContracts/schemas/Permission';

const OTHER = 'usr_other';

const AccountsSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      isBanned: z.boolean(),
      position: z.number().nullable(),
      isAdministrator: z.boolean(),
    }),
  ),
});

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();
  const banAccount = vi.fn<(userId: string, reason: string) => Promise<boolean>>();
  const inviteAccount = vi.fn<
    (request: { name: string; email: string; password: string }) => Promise<{
      id: string;
      name: string;
      email: string;
      createdAt: string;
    } | null>
  >();
  const editAccount =
    vi.fn<
      (
        userId: string,
        changes: { name?: string; email?: string },
      ) => Promise<'changed' | 'missing' | 'taken'>
    >();
  const unbanAccount = vi.fn<(userId: string) => Promise<boolean>>();
  const removeAccount = vi.fn<(userId: string) => Promise<boolean>>();

  banAccount.mockResolvedValue(true);
  inviteAccount.mockResolvedValue({
    id: 'usr_new',
    name: 'Alex',
    email: 'alex@flux.local',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  editAccount.mockResolvedValue('changed');
  unbanAccount.mockResolvedValue(true);
  removeAccount.mockResolvedValue(true);

  const app = createApp({
    auth,
    settings,
    permissions,
    banAccount,
    unbanAccount,
    removeAccount,
    inviteAccount,
    editAccount,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    listUsers: () =>
      Promise.resolve([
        {
          id: 'usr_1',
          name: 'Dan',
          email: 'dan@flux.local',
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: OTHER,
          name: 'Sam',
          email: 'sam@flux.local',
          role: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ]),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
  });

  return {
    app,
    store,
    permissions,
    banAccount,
    unbanAccount,
    removeAccount,
    inviteAccount,
    editAccount,
  };
};

/**
 * Signs somebody in holding exactly the permissions named, at the rank given.
 */
const signedInWith = async (granted: readonly Permission[], position = 200) => {
  const context = build();
  const cookie = await signUpForTest(context.app);
  const account = context.store.user[0];

  if (granted.includes('administrator')) {
    await makeAdministrator(context.permissions, account?.id ?? '');
  } else {
    const role = await context.permissions.createRole({
      name: 'Purpose-made',
      position,
      permissions: [...granted],
    });

    await context.permissions.assignRole(account?.id ?? '', role.id);
  }

  const request = (path: string, method = 'GET', body?: object) =>
    context.app.request(`${TEST_ORIGIN}${path}`, {
      method,
      headers: {
        cookie,
        origin: TEST_ORIGIN,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return { ...context, request, actorId: account?.id ?? '' };
};

describe('account administration', () => {
  describe('better-auth’s own admin endpoints', () => {
    it('are closed, so there is one answer to what an account may do', async () => {
      const { app } = build();

      for (const path of [
        '/api/auth/admin/list-users',
        '/api/auth/admin/set-role',
        '/api/auth/admin/ban-user',
        '/api/auth/admin/remove-user',
      ]) {
        const response = await app.request(`${TEST_ORIGIN}${path}`, {
          method: 'POST',
          headers: { origin: TEST_ORIGIN },
        });

        expect(response.status).toBe(404);
      }
    });

    it('are closed even to an administrator, since Flux serves them itself', async () => {
      const context = await signedInWith(['administrator']);

      expect((await context.request('/api/auth/admin/list-users', 'POST')).status).toBe(404);
    });

    it('says where the operations moved to', async () => {
      const { app } = build();
      const response = await app.request(`${TEST_ORIGIN}/api/auth/admin/list-users`, {
        method: 'POST',
        headers: { origin: TEST_ORIGIN },
      });

      expect(await response.text()).toContain('/api/admin/accounts');
    });

    it('leaves the rest of better-auth alone', async () => {
      const { app } = build();
      const response = await app.request(`${TEST_ORIGIN}/api/auth/get-session`, {
        headers: { origin: TEST_ORIGIN },
      });

      expect(response.status).not.toBe(404);
    });
  });

  describe('listing', () => {
    it('refuses somebody without account.manage', async () => {
      const context = await signedInWith(['account.ban']);

      expect((await context.request('/api/admin/accounts')).status).toBe(403);
    });

    it('reports each account with what it holds', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request('/api/admin/accounts');
      const body = AccountsSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(body.accounts.map((account) => account.email)).toContain('sam@flux.local');
      expect(body.accounts.every((account) => account.isBanned === false)).toBe(true);
    });

    it('says who is an administrator by what they resolve to, not by a column', async () => {
      const context = await signedInWith(['administrator']);

      await context.permissions.assignRole(
        OTHER,
        (await context.permissions.listRoles()).find((role) => role.name === 'Administrator')?.id ??
          '',
      );

      const body = AccountsSchema.parse(
        await (await context.request('/api/admin/accounts')).json(),
      );

      expect(body.accounts.find((account) => account.id === OTHER)?.isAdministrator).toBe(true);
    });

    it('answers a null rank for somebody holding no role', async () => {
      const context = await signedInWith(['administrator']);
      const body = AccountsSchema.parse(
        await (await context.request('/api/admin/accounts')).json(),
      );

      expect(body.accounts.find((account) => account.id === OTHER)?.position).toBeNull();
    });
  });

  describe('banning', () => {
    it('refuses somebody without account.ban', async () => {
      const context = await signedInWith(['account.manage']);
      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(403);
      expect(context.banAccount).not.toHaveBeenCalled();
    });

    it('bans somebody below the actor', async () => {
      const context = await signedInWith(['account.ban']);
      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(204);
      expect(context.banAccount).toHaveBeenCalledWith(OTHER, 'because');
    });

    it('refuses to ban somebody who outranks the actor', async () => {
      const context = await signedInWith(['account.ban'], 100);
      const senior = await context.permissions.createRole({
        name: 'Senior',
        position: 500,
        permissions: [],
      });

      await context.permissions.assignRole(OTHER, senior.id);

      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(403);
      expect(await response.text()).toContain('at or above your own rank');
    });

    it('refuses to ban yourself', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(`/api/admin/accounts/${context.actorId}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(403);
      expect(await response.text()).toContain('your own account');
    });

    it('refuses to ban the last administrator', async () => {
      const context = await signedInWith(['account.ban'], 900);
      const administrator = (await context.permissions.listRoles()).find(
        (role) => role.name === 'Administrator',
      );

      await context.permissions.assignRole(OTHER, administrator?.id ?? '');

      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('nobody able to administer');
      expect(context.banAccount).not.toHaveBeenCalled();
    });

    it('reports an account that is not there', async () => {
      const context = await signedInWith(['account.ban']);

      context.banAccount.mockResolvedValue(false);

      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'POST', {
        reason: 'because',
      });

      expect(response.status).toBe(404);
    });

    it('lets a ban be lifted', async () => {
      const context = await signedInWith(['account.ban']);
      const response = await context.request(`/api/admin/accounts/${OTHER}/ban`, 'DELETE');

      expect(response.status).toBe(204);
      expect(context.unbanAccount).toHaveBeenCalledWith(OTHER);
    });
  });

  describe('inviting', () => {
    it('refuses somebody without account.invite', async () => {
      const context = await signedInWith(['account.manage']);
      const response = await context.request('/api/admin/accounts', 'POST', {
        name: 'Alex',
        email: 'alex@flux.local',
        password: 'a-long-enough-password',
      });

      expect(response.status).toBe(403);
      expect(context.inviteAccount).not.toHaveBeenCalled();
    });

    it('creates an account', async () => {
      const context = await signedInWith(['account.invite']);
      const response = await context.request('/api/admin/accounts', 'POST', {
        name: 'Alex',
        email: 'alex@flux.local',
        password: 'a-long-enough-password',
      });

      expect(response.status).toBe(201);
      expect(context.inviteAccount).toHaveBeenCalledWith({
        name: 'Alex',
        email: 'alex@flux.local',
        password: 'a-long-enough-password',
      });
    });

    it('refuses a password too short to be one', async () => {
      const context = await signedInWith(['account.invite']);
      const response = await context.request('/api/admin/accounts', 'POST', {
        name: 'Alex',
        email: 'alex@flux.local',
        password: 'short',
      });

      expect(response.status).toBe(400);
      expect(context.inviteAccount).not.toHaveBeenCalled();
    });

    it('refuses something that is not an address', async () => {
      const context = await signedInWith(['account.invite']);
      const response = await context.request('/api/admin/accounts', 'POST', {
        name: 'Alex',
        email: 'not-an-address',
        password: 'a-long-enough-password',
      });

      expect(response.status).toBe(400);
    });

    it('reports an address already in use', async () => {
      const context = await signedInWith(['account.invite']);

      context.inviteAccount.mockResolvedValue(null);

      const response = await context.request('/api/admin/accounts', 'POST', {
        name: 'Alex',
        email: 'dan@flux.local',
        password: 'a-long-enough-password',
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('already in use');
    });
  });

  describe('editing', () => {
    it('refuses somebody without account.manage', async () => {
      const context = await signedInWith(['account.ban']);
      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        name: 'Samantha',
      });

      expect(response.status).toBe(403);
    });

    it('changes a name', async () => {
      const context = await signedInWith(['account.manage']);
      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        name: 'Samantha',
      });

      expect(response.status).toBe(204);
      expect(context.editAccount).toHaveBeenCalledWith(OTHER, { name: 'Samantha' });
    });

    it('sends only what was asked for, rather than undefined over the rest', async () => {
      const context = await signedInWith(['account.manage']);

      await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        email: 'sam@elsewhere.local',
      });

      expect(context.editAccount).toHaveBeenCalledWith(OTHER, { email: 'sam@elsewhere.local' });
    });

    it('lets somebody change their own name, unlike banning themselves', async () => {
      const context = await signedInWith(['account.manage']);
      const response = await context.request(`/api/admin/accounts/${context.actorId}`, 'PATCH', {
        name: 'Daniel',
      });

      expect(response.status).toBe(204);
    });

    it('refuses to edit somebody who outranks the actor', async () => {
      const context = await signedInWith(['account.manage'], 100);
      const senior = await context.permissions.createRole({
        name: 'Senior',
        position: 500,
        permissions: [],
      });

      await context.permissions.assignRole(OTHER, senior.id);

      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        name: 'Samantha',
      });

      expect(response.status).toBe(403);
    });

    it('reports an address already in use', async () => {
      const context = await signedInWith(['account.manage']);

      context.editAccount.mockResolvedValue('taken');

      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        email: 'dan@flux.local',
      });

      expect(response.status).toBe(400);
    });

    it('reports an account that is not there', async () => {
      const context = await signedInWith(['account.manage']);

      context.editAccount.mockResolvedValue('missing');

      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'PATCH', {
        name: 'Samantha',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('removing', () => {
    it('refuses somebody without account.manage', async () => {
      const context = await signedInWith(['account.ban']);

      expect((await context.request(`/api/admin/accounts/${OTHER}`, 'DELETE')).status).toBe(403);
    });

    it('removes somebody below the actor', async () => {
      const context = await signedInWith(['account.manage']);
      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'DELETE');

      expect(response.status).toBe(204);
      expect(context.removeAccount).toHaveBeenCalledWith(OTHER);
    });

    it('refuses to remove yourself, which no admin count would catch', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(`/api/admin/accounts/${context.actorId}`, 'DELETE');

      expect(response.status).toBe(403);
      expect(context.removeAccount).not.toHaveBeenCalled();
    });

    it('refuses to remove the last administrator', async () => {
      const context = await signedInWith(['account.manage'], 900);
      const administrator = (await context.permissions.listRoles()).find(
        (role) => role.name === 'Administrator',
      );

      await context.permissions.assignRole(OTHER, administrator?.id ?? '');

      const response = await context.request(`/api/admin/accounts/${OTHER}`, 'DELETE');

      expect(response.status).toBe(400);
      expect(context.removeAccount).not.toHaveBeenCalled();
    });
  });
});
