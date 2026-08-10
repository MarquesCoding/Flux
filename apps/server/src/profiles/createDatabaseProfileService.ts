import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import SchemaModule from '@FluxServer/db/Schema'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import type { FluxDatabase } from '@FluxServer/db/Database'
import type { ProfileService } from './ProfileService'
import type { ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { viewerProfile } = SchemaModule
const { ProfileColourSchema, PROFILE_COLOURS } = ViewerProfileModule

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

const toProfile = (row: ProfileRow): ViewerProfile => ({
  id: row.id,
  name: row.name,
  colour: readColour(row.colour),
  createdAt: row.createdAt.toISOString(),
})

/**
 * Profiles held in Postgres.
 */
const createDatabaseProfileService = (db: FluxDatabase): ProfileService => {
  const listFor = async (userId: string): Promise<ViewerProfile[]> => {
    const rows = await db
      .select({
        id: viewerProfile.id,
        name: viewerProfile.name,
        colour: viewerProfile.colour,
        createdAt: viewerProfile.createdAt,
      })
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
        createdAt: new Date().toISOString(),
      }
    },

    rename: async (userId, profileId, request) => {
      const changed = await db
        .update(viewerProfile)
        .set({ name: request.name, colour: request.colour, updatedAt: new Date() })
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
