import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { and, asc, eq } from 'drizzle-orm';
import { drawAvatar, isAvatarStyle } from './drawAvatar';
import { viewerProfile, user } from '@FluxServer/db/Schema';
import { ProfileColourSchema, PROFILE_COLOURS } from '@FluxContracts/schemas/ViewerProfile';
import type { FluxDatabase } from '@FluxServer/db/Database';
import type { ProfileService } from './ProfileService';
import type { ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
};

const MOVING_FORMATS = new Set(['.webm', '.mp4']);

const PHOTO_MAX_BYTES = 6 * 1024 * 1024;

const PHOTO_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(PHOTO_TYPES).map(([contentType, extension]) => [extension, contentType]),
);

const [DEFAULT_COLOUR] = PROFILE_COLOURS;

const LIMIT = 6;

type ProfileRow = {
  id: string;
  name: string;
  colour: string;
  avatarStyle: string | null;
  avatarSeed: string | null;
  photoPath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Reads a profile's colour from what is stored, falling back to the default rather than failing —
 * a colour written by an older version should leave a profile plain, not unreadable.
 *
 * @param stored - The colour column as stored.
 * @returns The colour to draw with.
 */
const readColour = (stored: string): ProfileColour => {
  const parsed = ProfileColourSchema.safeParse(stored);

  return parsed.success ? parsed.data : DEFAULT_COLOUR;
};

/**
 * Reads what a profile is drawn with — an uploaded photograph, a drawn avatar, or its initial —
 * from the columns that hold each, checked rather than trusted.
 *
 * @param row - The profile row as stored.
 * @returns What to draw.
 */
const readAvatarChoice = (row: ProfileRow): ViewerProfile['avatar'] => {
  if (row.photoPath !== null) {
    return { kind: 'photo', isVideo: MOVING_FORMATS.has(extname(row.photoPath)) };
  }

  if (row.avatarStyle !== null && row.avatarSeed !== null && isAvatarStyle(row.avatarStyle)) {
    return { kind: 'drawn', style: row.avatarStyle, seed: row.avatarSeed };
  }

  return { kind: 'initial' };
};

const toProfile = (row: ProfileRow): ViewerProfile => ({
  id: row.id,
  name: row.name,
  colour: readColour(row.colour),
  avatar: readAvatarChoice(row),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Turns a chosen avatar into the columns that hold it, so that choosing one kind clears whatever
 * the other kind had left behind.
 *
 * @param choice - What the profile should be drawn with.
 * @returns The columns to write.
 */
const avatarColumns = (
  avatar: ViewerProfile['avatar'] | undefined,
): { avatarStyle: string | null; avatarSeed: string | null; photoPath: string | null } | null => {
  if (avatar === undefined) {
    return null;
  }

  if (avatar.kind === 'drawn') {
    return { avatarStyle: avatar.style, avatarSeed: avatar.seed, photoPath: null };
  }

  if (avatar.kind === 'initial') {
    return { avatarStyle: null, avatarSeed: null, photoPath: null };
  }

  return null;
};

const COLUMNS = {
  id: viewerProfile.id,
  name: viewerProfile.name,
  colour: viewerProfile.colour,
  avatarStyle: viewerProfile.avatarStyle,
  avatarSeed: viewerProfile.avatarSeed,
  photoPath: viewerProfile.photoPath,
  createdAt: viewerProfile.createdAt,
  updatedAt: viewerProfile.updatedAt,
};

const createDatabaseProfileService = (db: FluxDatabase, photoDirectory: string): ProfileService => {
  const listFor = async (userId: string): Promise<ViewerProfile[]> => {
    const rows = await db
      .select(COLUMNS)
      .from(viewerProfile)
      .where(eq(viewerProfile.userId, userId))
      .orderBy(asc(viewerProfile.createdAt));

    return rows.map(toProfile);
  };

  /**
   * Finds the profile an account watches under, creating one named after the account where it has
   * none — every account has a profile, since watch progress and history hang off it rather than off
   * the account.
   *
   * @param userId - The account being asked about.
   * @returns The profile to use.
   */
  const ensure = async (userId: string, name: string): Promise<ViewerProfile> => {
    const existing = await listFor(userId);
    const first = existing[0];

    if (first !== undefined) {
      return first;
    }

    const created = {
      id: randomUUID(),
      userId,
      name: name.trim() === '' ? 'Me' : name.trim(),
      colour: DEFAULT_COLOUR,
    };

    await db.insert(viewerProfile).values(created);

    return {
      id: created.id,
      name: created.name,
      colour: readColour(created.colour),
      avatar: { kind: 'initial' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  return {
    list: listFor,

    ensureDefault: ensure,

    create: async (userId, request) => {
      const existing = await listFor(userId);

      if (existing.length >= LIMIT) {
        throw new Error(`An account may hold ${LIMIT.toString()} profiles.`);
      }

      const created = {
        id: randomUUID(),
        userId,
        name: request.name,
        colour: request.colour,
      };

      await db.insert(viewerProfile).values(created);

      return {
        id: created.id,
        name: created.name,
        colour: created.colour,
        avatar: { kind: 'initial' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },

    rename: async (userId, profileId, request) => {
      const chosen = avatarColumns(request.avatar);

      const changed = await db
        .update(viewerProfile)
        .set({
          name: request.name,
          colour: request.colour,
          updatedAt: new Date(),
          ...chosen,
        })
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .returning({ id: viewerProfile.id });

      return changed.length > 0;
    },

    remove: async (userId, profileId) => {
      const existing = await listFor(userId);

      if (existing.length <= 1) {
        return false;
      }

      const removed = await db
        .delete(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .returning({ id: viewerProfile.id });

      return removed.length > 0;
    },

    belongsTo: async (userId, profileId) => {
      const rows = await db
        .select({ id: viewerProfile.id })
        .from(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .limit(1);

      return rows.length > 0;
    },

    listEveryone: async () => {
      const rows = await db
        .select({
          userId: user.id,
          userName: user.name,
          createdAt: user.createdAt,
          profile: COLUMNS,
        })
        .from(user)
        .leftJoin(viewerProfile, eq(viewerProfile.userId, user.id))
        .orderBy(asc(user.createdAt));

      const seen = new Set<string>();
      const everyone: ViewerProfile[] = [];

      for (const row of rows) {
        if (seen.has(row.userId)) {
          continue;
        }

        seen.add(row.userId);

        const found = row.profile;

        everyone.push(
          found === null
            ? await ensure(row.userId, row.userName)
            : toProfile({
                id: found.id,
                name: found.name,
                colour: found.colour,
                avatarStyle: found.avatarStyle,
                avatarSeed: found.avatarSeed,
                photoPath: found.photoPath,
                createdAt: found.createdAt,
                updatedAt: found.updatedAt,
              }),
        );
      }

      return everyone;
    },

    findSignInEmail: async (profileId) => {
      const rows = await db
        .select({ email: user.email })
        .from(viewerProfile)
        .innerJoin(user, eq(user.id, viewerProfile.userId))
        .where(eq(viewerProfile.id, profileId))
        .limit(1);

      return rows[0]?.email ?? null;
    },

    readAvatar: async (profileId) => {
      const rows = await db
        .select(COLUMNS)
        .from(viewerProfile)
        .where(eq(viewerProfile.id, profileId))
        .limit(1);
      const found = rows[0];

      if (found === undefined) {
        return null;
      }

      const choice = readAvatarChoice(found);

      if (choice.kind === 'drawn') {
        return {
          body: new TextEncoder().encode(drawAvatar(choice.style, choice.seed)),
          contentType: 'image/svg+xml',
        };
      }

      if (choice.kind === 'photo' && found.photoPath !== null) {
        const body = await readFile(found.photoPath).catch(() => null);

        if (body !== null) {
          return {
            body,
            contentType: PHOTO_CONTENT_TYPES[extname(found.photoPath)] ?? 'image/jpeg',
          };
        }
      }

      return null;
    },

    savePhoto: async (userId, profileId, photo) => {
      const extension = PHOTO_TYPES[photo.contentType];

      if (extension === undefined || photo.body.byteLength > PHOTO_MAX_BYTES) {
        return false;
      }

      const owned = await db
        .select({ id: viewerProfile.id })
        .from(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .limit(1);

      if (owned.length === 0) {
        return false;
      }

      await mkdir(photoDirectory, { recursive: true });

      const path = join(photoDirectory, `${profileId}${extension}`);

      await writeFile(path, photo.body);

      await db
        .update(viewerProfile)
        .set({ photoPath: path, avatarStyle: null, avatarSeed: null, updatedAt: new Date() })
        .where(eq(viewerProfile.id, profileId));

      return true;
    },

    moveTo: async (profileId, newOwnerId) => {
      const moved = await db
        .update(viewerProfile)
        .set({ userId: newOwnerId, updatedAt: new Date() })
        .where(eq(viewerProfile.id, profileId))
        .returning({ id: viewerProfile.id });

      return moved.length > 0;
    },
  };
};

export { createDatabaseProfileService, LIMIT };
