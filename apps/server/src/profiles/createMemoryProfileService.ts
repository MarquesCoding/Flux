import { randomUUID } from 'node:crypto';
import { PROFILE_COLOURS } from '@FluxContracts/schemas/ViewerProfile';
import { STILL_WATCHING_DEFAULT } from '@FluxContracts/schemas/StillWatching';
import { drawAvatar, isAvatarStyle } from './drawAvatar';
import type { ProfileService } from './ProfileService';
import type { Avatar, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

type Held = { profile: ViewerProfile; userId: string; email: string; photo: Uint8Array | null };

type MemoryState = Held[];

const DEFAULT_COLOUR = PROFILE_COLOURS[0];

let ticks = 0;

/**
 * Hands out timestamps that always differ and always increase, so that profiles made in the same
 * millisecond still sort in the order they were made. Only the in-memory service needs this; the
 * database has its own clock.
 *
 * @returns The next timestamp.
 */
const stamp = (): string => {
  ticks += 1;

  return new Date(ticks).toISOString();
};

/**
 * Profiles held in memory, so the routes can be exercised without Postgres.
 *
 * @param state - Any profiles that already exist.
 * @returns The profile service.
 */
const createMemoryProfileService = (
  state: MemoryState = [],
): ProfileService & { state: MemoryState } => {
  const listFor = (userId: string): ViewerProfile[] =>
    state.filter((held) => held.userId === userId).map((held) => held.profile);

  const find = (profileId: string): Held | undefined =>
    state.find((held) => held.profile.id === profileId);

  const add = (userId: string, name: string, colour: string, avatar: Avatar): ViewerProfile => {
    const profile: ViewerProfile = {
      id: randomUUID(),
      name,
      colour: PROFILE_COLOURS.find((known) => known === colour) ?? DEFAULT_COLOUR,
      avatar,
      askStillWatchingAfter: STILL_WATCHING_DEFAULT,
      showsWhatIamWatching: false,
      createdAt: stamp(),
      updatedAt: stamp(),
    };

    state.push({ profile, userId, email: `${userId}@flux.local`, photo: null });

    return profile;
  };

  return {
    state,

    list: (userId) => Promise.resolve(listFor(userId)),

    ensureDefault: (userId, name) => {
      const [existing] = listFor(userId);

      return Promise.resolve(existing ?? add(userId, name, DEFAULT_COLOUR, { kind: 'initial' }));
    },

    create: (userId, request) =>
      Promise.resolve(
        add(userId, request.name, request.colour, request.avatar ?? { kind: 'initial' }),
      ),

    rename: (userId, profileId, request) => {
      const held = find(profileId);

      if (held === undefined || held.userId !== userId) {
        return Promise.resolve(false);
      }

      held.profile = {
        ...held.profile,
        name: request.name,
        colour: request.colour,
        avatar: request.avatar ?? held.profile.avatar,
        updatedAt: stamp(),
      };

      return Promise.resolve(true);
    },

    remove: (userId, profileId) => {
      if (listFor(userId).length <= 1) {
        return Promise.resolve(false);
      }

      const at = state.findIndex((held) => held.profile.id === profileId && held.userId === userId);

      if (at === -1) {
        return Promise.resolve(false);
      }

      state.splice(at, 1);

      return Promise.resolve(true);
    },

    belongsTo: (userId, profileId) =>
      Promise.resolve(find(profileId)?.userId === userId && userId !== ''),

    moveTo: (profileId, newOwnerId) => {
      const held = find(profileId);

      if (held === undefined) {
        return Promise.resolve(false);
      }

      held.userId = newOwnerId;
      held.profile = { ...held.profile, updatedAt: stamp() };

      return Promise.resolve(true);
    },

    readAvatar: (profileId) => {
      const held = find(profileId);

      if (held === undefined) {
        return Promise.resolve(null);
      }

      if (held.photo !== null) {
        return Promise.resolve({ body: held.photo, contentType: 'image/webp' });
      }

      const { avatar } = held.profile;

      if (avatar.kind !== 'drawn' || !isAvatarStyle(avatar.style)) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        body: new TextEncoder().encode(drawAvatar(avatar.style, avatar.seed)),
        contentType: 'image/svg+xml',
      });
    },

    listEveryone: () => Promise.resolve(state.map((held) => held.profile)),

    findSignInEmail: (profileId) => Promise.resolve(find(profileId)?.email ?? null),

    accountOf: (profileId) => Promise.resolve(find(profileId)?.userId ?? null),

    savePhoto: (userId, profileId, photo) => {
      const held = find(profileId);

      if (held === undefined || held.userId !== userId) {
        return Promise.resolve(false);
      }

      held.photo = photo.body;
      held.profile = {
        ...held.profile,
        avatar: { kind: 'photo', isVideo: photo.contentType.startsWith('video/') },
        updatedAt: stamp(),
      };

      return Promise.resolve(true);
    },
  };
};

export type { MemoryState };

export { createMemoryProfileService };
