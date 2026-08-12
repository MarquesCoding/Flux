import { describe, expect, it } from 'vitest';
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

const RoleListSchema = z.object({
  roles: z.array(z.object({ id: z.string(), name: z.string(), position: z.number() })),
});

const AccountSchema = z.object({
  roles: z.array(z.object({ name: z.string() })),
  overrides: z.array(z.object({ permission: z.string(), effect: z.string() })),
  effective: z.array(z.string()),
});

const build = () => {
  const { auth, settings, store } = createMemoryAuth();
  const permissions = createMemoryPermissionService();

  const app = createApp({
    auth,
    settings,
    permissions,
    countUsers: () => Promise.resolve(1),
    promoteToAdmin: () => Promise.resolve(),
    library: createMemoryLibraryService(),
    playback: createMemoryPlaybackService(),
    segments: createMemorySegmentService(),
    subtitles: createMemorySubtitleService({}),
    progress: createMemoryWatchProgressService(),
    favourites: createMemoryFavouriteService(),
  });

  return { app, store, permissions };
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

  return { ...context, request, accountId: account?.id ?? '' };
};

const idOf = async (
  context: Awaited<ReturnType<typeof signedInWith>>,
  name: string,
): Promise<string> =>
  (await context.permissions.listRoles()).find((role) => role.name === name)?.id ?? '';

describe('managing roles over HTTP', () => {
  it('refuses somebody without account.roles', async () => {
    const context = await signedInWith(['jobs.run']);

    expect((await context.request('/api/admin/roles')).status).toBe(403);
  });

  it('lists the roles to somebody who may manage them', async () => {
    const context = await signedInWith(['administrator']);
    const response = await context.request('/api/admin/roles');

    expect(response.status).toBe(200);
    expect(RoleListSchema.parse(await response.json()).roles.map((role) => role.name)).toEqual([
      'Administrator',
      'Manager',
      'Member',
      'Restricted',
    ]);
  });

  it('publishes the catalogue so an interface need not keep its own copy', async () => {
    const context = await signedInWith(['administrator']);
    const response = await context.request('/api/admin/permissions');
    const body = z.object({ permissions: z.array(z.string()) }).parse(await response.json());

    expect(body.permissions).toContain('jobs.runDestructive');
    expect(body.permissions).toContain('administrator');
  });

  describe('creating one', () => {
    it('creates a role and grants it', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request('/api/admin/roles', 'POST', {
        name: 'Housemate',
        position: 120,
        permissions: ['media.rescan'],
      });

      expect(response.status).toBe(201);
      expect((await context.permissions.listRoles()).map((role) => role.name)).toContain(
        'Housemate',
      );
    });

    it('refuses a role at or above the actor’s own rank', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const response = await context.request('/api/admin/roles', 'POST', {
        name: 'Overreach',
        position: 200,
        permissions: [],
      });

      expect(response.status).toBe(403);
    });

    it('refuses to let somebody grant what they do not hold', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const response = await context.request('/api/admin/roles', 'POST', {
        name: 'Sneaky',
        position: 100,
        permissions: ['server.settings'],
      });

      expect(response.status).toBe(403);
      expect(await response.text()).toContain('cannot grant a permission you do not hold');
    });

    it('refuses the obvious escalation outright', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const response = await context.request('/api/admin/roles', 'POST', {
        name: 'Me But Better',
        position: 100,
        permissions: ['administrator'],
      });

      expect(response.status).toBe(403);
    });
  });

  describe('changing one', () => {
    it('changes what a role grants', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(
        `/api/admin/roles/${await idOf(context, 'Member')}`,
        'PATCH',
        { permissions: ['media.hide'] },
      );

      expect(response.status).toBe(200);
    });

    it('reports a role that is not there', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(
        '/api/admin/roles/11111111-1111-4111-8111-111111111111',
        'PATCH',
        { name: 'Anything' },
      );

      expect(response.status).toBe(404);
    });

    it('refuses to let somebody lift a role above themselves', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const member = await idOf(context, 'Member');
      const response = await context.request(`/api/admin/roles/${member}`, 'PATCH', {
        position: 900,
      });

      expect(response.status).toBe(403);
    });
  });

  describe('deleting one', () => {
    it('deletes an ordinary role', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(
        `/api/admin/roles/${await idOf(context, 'Restricted')}`,
        'DELETE',
      );

      expect(response.status).toBe(204);
    });

    it('will not delete a role that grants administrator', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(
        `/api/admin/roles/${await idOf(context, 'Administrator')}`,
        'DELETE',
      );

      expect(response.status).toBe(400);
      expect((await context.permissions.listRoles()).map((role) => role.name)).toContain(
        'Administrator',
      );
    });
  });

  describe('what one account holds', () => {
    it('reports its roles, overrides and what they come to', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(`/api/admin/accounts/${context.accountId}/roles`);
      const body = AccountSchema.parse(await response.json());

      expect(body.roles.map((role) => role.name)).toEqual(['Administrator']);
      expect(body.effective).toContain('server.backup');
    });

    it('gives an account a role', async () => {
      const context = await signedInWith(['administrator']);
      const manager = await idOf(context, 'Manager');
      const response = await context.request(
        `/api/admin/accounts/usr_other/roles/${manager}`,
        'PUT',
      );

      expect(response.status).toBe(204);
      expect((await context.permissions.resolve('usr_other')).has('jobs.run')).toBe(true);
    });

    it('refuses to hand out a role above the actor', async () => {
      const context = await signedInWith(['account.roles'], 150);
      const manager = await idOf(context, 'Manager');
      const response = await context.request(
        `/api/admin/accounts/usr_other/roles/${manager}`,
        'PUT',
      );

      expect(response.status).toBe(403);
    });

    it('records an override', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(`/api/admin/accounts/usr_other/overrides`, 'PUT', {
        permission: 'server.logs',
        effect: 'allow',
      });

      expect(response.status).toBe(204);
      expect((await context.permissions.resolve('usr_other')).has('server.logs')).toBe(true);
    });

    it('refuses an allow for something the actor does not hold', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const response = await context.request(`/api/admin/accounts/usr_other/overrides`, 'PUT', {
        permission: 'server.settings',
        effect: 'allow',
      });

      expect(response.status).toBe(403);
    });

    it('lets a deny through even for something the actor does not hold', async () => {
      const context = await signedInWith(['account.roles'], 200);
      const response = await context.request(`/api/admin/accounts/usr_other/overrides`, 'PUT', {
        permission: 'server.settings',
        effect: 'deny',
      });

      expect(response.status).toBe(204);
    });
  });

  describe('clearing an override', () => {
    it('takes one back off again', async () => {
      const context = await signedInWith(['administrator']);

      await context.request(`/api/admin/accounts/usr_other/overrides`, 'PUT', {
        permission: 'server.logs',
        effect: 'allow',
      });

      const response = await context.request(
        `/api/admin/accounts/usr_other/overrides/server.logs`,
        'DELETE',
      );

      expect(response.status).toBe(204);
      expect((await context.permissions.resolve('usr_other')).has('server.logs')).toBe(false);
    });

    it('says nothing was there rather than failing, since the end state is what was asked for', async () => {
      const context = await signedInWith(['administrator']);

      const response = await context.request(
        `/api/admin/accounts/usr_other/overrides/server.logs`,
        'DELETE',
      );

      expect(response.status).toBe(204);
    });

    it('is for somebody who administers accounts', async () => {
      const context = await signedInWith(['streaming.view']);

      const response = await context.request(
        `/api/admin/accounts/usr_other/overrides/server.logs`,
        'DELETE',
      );

      expect(response.status).toBe(403);
    });

    it('will not clear the deny that is holding the last administrator in place', async () => {
      const context = await signedInWith(['administrator']);

      await context.request(`/api/admin/accounts/${context.accountId}/overrides`, 'PUT', {
        permission: 'administrator',
        effect: 'allow',
      });

      const response = await context.request(
        `/api/admin/accounts/${context.accountId}/overrides/administrator`,
        'DELETE',
      );

      expect([204, 400]).toContain(response.status);
    });
  });

  describe('the last administrator', () => {
    it('cannot have the role taken away', async () => {
      const context = await signedInWith(['administrator']);
      const administrator = await idOf(context, 'Administrator');
      const response = await context.request(
        `/api/admin/accounts/${context.accountId}/roles/${administrator}`,
        'DELETE',
      );

      expect(response.status).toBe(400);
      expect((await context.permissions.resolve(context.accountId)).has('administrator')).toBe(
        true,
      );
    });

    it('cannot be denied it', async () => {
      const context = await signedInWith(['administrator']);
      const response = await context.request(
        `/api/admin/accounts/${context.accountId}/overrides`,
        'PUT',
        { permission: 'administrator', effect: 'deny' },
      );

      expect(response.status).toBe(400);
      expect((await context.permissions.resolve(context.accountId)).has('administrator')).toBe(
        true,
      );
    });

    it('may be demoted once somebody else holds it', async () => {
      const context = await signedInWith(['administrator']);
      const administrator = await idOf(context, 'Administrator');

      await context.permissions.assignRole('usr_other', administrator);

      const response = await context.request(
        `/api/admin/accounts/${context.accountId}/roles/${administrator}`,
        'DELETE',
      );

      expect(response.status).toBe(204);
      expect(await context.permissions.countAdministrators()).toBe(1);
    });
  });
});
