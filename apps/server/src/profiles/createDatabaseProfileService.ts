import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { and, asc, eq } from 'drizzle-orm'
import drawAvatarModule from './drawAvatar'
import SchemaModule from '@FluxServer/db/Schema'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { ProfileService } from './ProfileService'
import type { ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { viewerProfile } = SchemaModule
const { ProfileColourSchema, PROFILE_COLOURS } = ViewerProfileModule
const { drawAvatar, isAvatarStyle } = drawAvatarModule

/**
 * The picture formats a profile photograph may arrive in.
 *
 * Raster formats only. An uploaded SVG is a document that can carry script,
 * and there is no reason a photograph of somebody needs to be one.
 */
const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

/**
 * How large a profile photograph may be.
 *
 * Two megabytes is a generous photograph of a face at any size this is drawn.
 */
const PHOTO_MAX_BYTES = 2 * 1024 * 1024

/**
 * The same mapping read the other way, for serving what was stored.
 */
const PHOTO_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(PHOTO_TYPES).map(([contentType, extension]) => [extension, contentType]),
)

/**
 * The colour a profile nobody chose one for is drawn in.
 */
const [DEFAULT_COLOUR] = PROFILE_COLOURS

/**
 * How many people may share one account.
 *
 * A household, not a tenancy. The limit exists so that a shared login cannot
 * quietly become a service somebody is running for a hundred people on a
 * machine sized for six.
 */
const LIMIT = 6

type ProfileRow = {
  id: string
  name: string
  colour: string
  avatarStyle: string | null
  avatarSeed: string | null
  photoPath: string | null
  createdAt: Date
}

/**
 * Reads a stored colour, falling back rather than failing.
 *
 * A row written before a colour was retired is still a person's profile, and
 * refusing to draw it would lose them their viewing over a shade.
 */
const readColour = (stored: string): ProfileColour => {
  const parsed = ProfileColourSchema.safeParse(stored)

  return parsed.success ? parsed.data : DEFAULT_COLOUR
}

/**
 * What a stored row says the profile is drawn with.
 *
 * A photograph wins over a drawn face, and a letter is what is left when
 * neither has been chosen.
 */
const readAvatarChoice = (row: ProfileRow): ViewerProfile['avatar'] => {
  if (row.photoPath !== null) {
    return { kind: 'photo' }
  }

  if (row.avatarStyle !== null && row.avatarSeed !== null && isAvatarStyle(row.avatarStyle)) {
    return { kind: 'drawn', style: row.avatarStyle, seed: row.avatarSeed }
  }

  return { kind: 'initial' }
}

const toProfile = (row: ProfileRow): ViewerProfile => ({
  id: row.id,
  name: row.name,
  colour: readColour(row.colour),
  avatar: readAvatarChoice(row),
  createdAt: row.createdAt.toISOString(),
})

/**
 * How a chosen avatar is written to the columns that hold it.
 *
 * Choosing one clears the others, so a profile is never both a photograph and
 * a drawn face with the answer depending on which field is read first.
 */
const avatarColumns = (
  avatar: ViewerProfile['avatar'] | undefined,
): { avatarStyle: string | null; avatarSeed: string | null; photoPath: string | null } | null => {
  if (avatar === undefined) {
    return null
  }

  if (avatar.kind === 'drawn') {
    return { avatarStyle: avatar.style, avatarSeed: avatar.seed, photoPath: null }
  }

  if (avatar.kind === 'initial') {
    return { avatarStyle: null, avatarSeed: null, photoPath: null }
  }

  // A photograph is chosen by uploading one, not by asking for it. Saying
  // "photo" without having sent a photograph changes nothing.
  return null
}

/**
 * Profiles held in Postgres.
 */
/**
 * The columns a profile is read from, named once.
 */
const COLUMNS = {
  id: viewerProfile.id,
  name: viewerProfile.name,
  colour: viewerProfile.colour,
  avatarStyle: viewerProfile.avatarStyle,
  avatarSeed: viewerProfile.avatarSeed,
  photoPath: viewerProfile.photoPath,
  createdAt: viewerProfile.createdAt,
}

const createDatabaseProfileService = (
  db: FluxDatabase,
  /**
   * Where uploaded photographs are kept.
   */
  photoDirectory: string,
): ProfileService => {
  const listFor = async (userId: string): Promise<ViewerProfile[]> => {
    const rows = await db
      .select(COLUMNS)
      .from(viewerProfile)
      .where(eq(viewerProfile.userId, userId))
      .orderBy(asc(viewerProfile.createdAt))

    return rows.map(toProfile)
  }

  return {
    list: listFor,

    ensureDefault: async (userId, name) => {
      const existing = await listFor(userId)
      const first = existing[0]

      if (first !== undefined) {
        return first
      }

      const created = {
        id: randomUUID(),
        userId,
        name: name.trim() === '' ? 'Me' : name.trim(),
        colour: DEFAULT_COLOUR,
      }

      await db.insert(viewerProfile).values(created)

      // Only what the contract describes. The owning account is Flux's
      // business, not the browser's.
      return {
        id: created.id,
        name: created.name,
        colour: readColour(created.colour),
        avatar: { kind: 'initial' },
        createdAt: new Date().toISOString(),
      }
    },

    create: async (userId, request) => {
      const existing = await listFor(userId)

      if (existing.length >= LIMIT) {
        throw new Error(`An account may hold ${LIMIT.toString()} profiles.`)
      }

      const created = {
        id: randomUUID(),
        userId,
        name: request.name,
        colour: request.colour,
      }

      await db.insert(viewerProfile).values(created)

      return {
        id: created.id,
        name: created.name,
        colour: created.colour,
        avatar: { kind: 'initial' },
        createdAt: new Date().toISOString(),
      }
    },

    rename: async (userId, profileId, request) => {
      const chosen = avatarColumns(request.avatar)

      const changed = await db
        .update(viewerProfile)
        .set({
          name: request.name,
          colour: request.colour,
          updatedAt: new Date(),
          ...chosen,
        })
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .returning({ id: viewerProfile.id })

      return changed.length > 0
    },

    remove: async (userId, profileId) => {
      const existing = await listFor(userId)

      // The last one is not removable. Somewhere to record viewing is not
      // optional, and an account with no profiles would silently stop
      // remembering where anybody had got to.
      if (existing.length <= 1) {
        return false
      }

      const removed = await db
        .delete(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .returning({ id: viewerProfile.id })

      return removed.length > 0
    },

    belongsTo: async (userId, profileId) => {
      const rows = await db
        .select({ id: viewerProfile.id })
        .from(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .limit(1)

      return rows.length > 0
    },

    readAvatar: async (profileId) => {
      const rows = await db
        .select(COLUMNS)
        .from(viewerProfile)
        .where(eq(viewerProfile.id, profileId))
        .limit(1)
      const found = rows[0]

      if (found === undefined) {
        return null
      }

      const choice = readAvatarChoice(found)

      if (choice.kind === 'drawn') {
        return {
          body: new TextEncoder().encode(drawAvatar(choice.style, choice.seed)),
          contentType: 'image/svg+xml',
        }
      }

      if (choice.kind === 'photo' && found.photoPath !== null) {
        const body = await readFile(found.photoPath).catch(() => null)

        if (body !== null) {
          return {
            body,
            contentType: PHOTO_CONTENT_TYPES[extname(found.photoPath)] ?? 'image/jpeg',
          }
        }
      }

      // A letter on a colour is drawn by the browser, which already knows the
      // name and the colour. There is no picture to serve.
      return null
    },

    savePhoto: async (userId, profileId, photo) => {
      const extension = PHOTO_TYPES[photo.contentType]

      if (extension === undefined || photo.body.byteLength > PHOTO_MAX_BYTES) {
        return false
      }

      const owned = await db
        .select({ id: viewerProfile.id })
        .from(viewerProfile)
        .where(and(eq(viewerProfile.id, profileId), eq(viewerProfile.userId, userId)))
        .limit(1)

      if (owned.length === 0) {
        return false
      }

      await mkdir(photoDirectory, { recursive: true })

      // Named after the profile rather than after the upload, so a second
      // photograph replaces the first instead of leaving the old one on disk
      // with nothing pointing at it.
      const path = join(photoDirectory, `${profileId}${extension}`)

      await writeFile(path, photo.body)

      await db
        .update(viewerProfile)
        .set({ photoPath: path, avatarStyle: null, avatarSeed: null, updatedAt: new Date() })
        .where(eq(viewerProfile.id, profileId))

      return true
    },

    moveTo: async (profileId, newOwnerId) => {
      const moved = await db
        .update(viewerProfile)
        .set({ userId: newOwnerId, updatedAt: new Date() })
        .where(eq(viewerProfile.id, profileId))
        .returning({ id: viewerProfile.id })

      return moved.length > 0
    },
  }
}

export default { createDatabaseProfileService, LIMIT }
