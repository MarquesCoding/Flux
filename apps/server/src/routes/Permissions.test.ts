import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '@ValenceServer/App';
import { createMemoryAuth } from '@ValenceServer/auth/createMemoryAuth';
import { signUpForTest, makeAdministrator, TEST_ORIGIN } from '@ValenceServer/auth/signUpForTest';
import { createMemoryPermissionService } from '@ValenceServer/auth/createMemoryPermissionService';
import { createMemoryLibraryService } from '@ValenceServer/library/createMemoryLibraryService';
import { createMemoryPlaybackService } from '@ValenceServer/playback/createMemoryPlaybackService';
import { createMemoryWatchProgressService } from '@ValenceServer/progress/createMemoryWatchProgressService';
import { createMemoryFavouriteService } from '@ValenceServer/favourites/createMemoryFavouriteService';
import { createMemoryRatingService } from '@ValenceServer/ratings/createMemoryRatingService';
import { createMemorySegmentService } from '@ValenceServer/segments/createMemorySegmentService';
import { createMemorySubtitleService } from '@ValenceServer/subtitles/createMemorySubtitleService';
import { CreatedApiKeySchema } from '@ValenceContracts/schemas/ApiKey';
import type { Permission } from '@ValenceContracts/schemas/Permission';

const MyPermissionsAnswer = z.object({
  permissions: z.array(z.string()),
  isAdministrator: z.boolean(),
});

const PATH = '/api/account/permissions';

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
    ratings: createMemoryRatingService(),
  });

  return { app, store, permissions };
};

/**
 * Signs somebody up and gives them exactly what is asked for, then reads what the server says they
 * may do.
 *
 * @param granted - The permissions to put in a role of their own, or nothing at all.
 * @param isAdministrator - Whether to give them the Administrator role instead.
 * @returns The response, and the body where it was the shape it promised.
 */
const askWhatIMayDo = async (
  granted: readonly Permission[] = [],
  isAdministrator = false,
): Promise<{
  status: number;
  body: { permissions: string[]; isAdministrator: boolean } | null;
}> => {
  const context = build();
  const cookie = await signUpForTest(context.app);
  const account = context.store.user[0];

  if (isAdministrator) {
    await makeAdministrator(context.permissions, account?.id ?? '');
  } else if (granted.length > 0) {
    const role = await context.permissions.createRole({
      name: 'Purpose-made',
      position: 200,
      permissions: [...granted],
    });

    await context.permissions.assignRole(account?.id ?? '', role.id);
  }

  const response = await context.app.request(`${TEST_ORIGIN}${PATH}`, {
    headers: { cookie, origin: TEST_ORIGIN },
  });

  const read = MyPermissionsAnswer.safeParse(await response.json());

  return { status: response.status, body: read.success ? read.data : null };
};

/**
 * Signs up an administrator, who may therefore also hold keys. Narrowing only means anything to
 * somebody who holds more than the key they are asking with.
 *
 * @returns Making a key, and asking what may be done while holding one.
 */
const administratorHoldingKeys = async () => {
  const context = build();
  const cookie = await signUpForTest(context.app);

  await makeAdministrator(context.permissions, context.store.user[0]?.id ?? '');

  const mint = async (body: object) => {
    const made = await context.app.request(`${TEST_ORIGIN}/api/keys`, {
      method: 'POST',
      headers: { cookie, origin: TEST_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    return CreatedApiKeySchema.parse(await made.json());
  };

  const asKey = (key: string) =>
    context.app.request(`${TEST_ORIGIN}${PATH}`, {
      headers: { 'x-api-key': key, origin: TEST_ORIGIN },
    });

  return { mint, asKey };
};

describe('GET /api/account/permissions', () => {
  it('refuses somebody who is not signed in', async () => {
    const { app } = build();

    const response = await app.request(`${TEST_ORIGIN}${PATH}`, {
      headers: { origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(401);
  });

  it('says an account holding nothing may do nothing', async () => {
    const answer = await askWhatIMayDo();

    expect(answer.status).toBe(200);
    expect(answer.body).toStrictEqual({ permissions: [], isAdministrator: false });
  });

  it('names what a viewer was granted, without calling them an administrator', async () => {
    const answer = await askWhatIMayDo(['library.create', 'server.logs']);

    expect(answer.status).toBe(200);
    expect(answer.body?.isAdministrator).toBe(false);
    expect(answer.body?.permissions).toStrictEqual(
      expect.arrayContaining(['library.create', 'server.logs']),
    );
  });

  it('says an administrator is one, which is what the admin menu is gated on', async () => {
    const answer = await askWhatIMayDo([], true);

    expect(answer.status).toBe(200);
    expect(answer.body?.isAdministrator).toBe(true);
    expect(answer.body?.permissions).toStrictEqual(expect.arrayContaining(['administrator']));
  });

  it('answers from the roles an account holds rather than from the column better-auth keeps', async () => {
    const context = build();
    const cookie = await signUpForTest(context.app);
    const account = context.store.user[0];

    if (account !== undefined) {
      account.role = 'admin';
    }

    const response = await context.app.request(`${TEST_ORIGIN}${PATH}`, {
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(response.status).toBe(200);
    expect(MyPermissionsAnswer.parse(await response.json())).toStrictEqual({
      permissions: [],
      isAdministrator: false,
    });
  });

  it('narrows what it reports to what an api key was given, as every other route does', async () => {
    const { asKey, mint } = await administratorHoldingKeys();

    const narrow = await mint({ name: 'Just streaming', permissions: ['streaming.view'] });

    const response = await asKey(narrow.key);

    expect(response.status).toBe(200);
    expect(MyPermissionsAnswer.parse(await response.json())).toStrictEqual({
      permissions: ['streaming.view'],
      isAdministrator: false,
    });
  });

  it('reports everything the account holds to a key that was not narrowed', async () => {
    const { asKey, mint } = await administratorHoldingKeys();

    const whole = await mint({ name: 'Everything' });

    const response = await asKey(whole.key);

    expect(response.status).toBe(200);
    expect(MyPermissionsAnswer.parse(await response.json()).isAdministrator).toBe(true);
  });

  it('tells somebody promoted after they signed in that they may now administer', async () => {
    const context = build();
    const cookie = await signUpForTest(context.app);
    const account = context.store.user[0];

    const before = await context.app.request(`${TEST_ORIGIN}${PATH}`, {
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(MyPermissionsAnswer.parse(await before.json()).isAdministrator).toBe(false);

    await makeAdministrator(context.permissions, account?.id ?? '');

    const after = await context.app.request(`${TEST_ORIGIN}${PATH}`, {
      headers: { cookie, origin: TEST_ORIGIN },
    });

    expect(MyPermissionsAnswer.parse(await after.json()).isAdministrator).toBe(true);
  });
});
