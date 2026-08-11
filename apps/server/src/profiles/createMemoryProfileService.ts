import { randomUUID } from 'node:crypto'
import { PROFILE_COLOURS } from '@FluxContracts/schemas/ViewerProfile'
import { drawAvatar, isAvatarStyle } from './drawAvatar'
import type { ProfileService } from './ProfileService'
import type { Avatar, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

/**
 * A profile and the account it hangs on.
 */
type Held = { profile: ViewerProfile; userId: string; email: string; photo: Uint8Array | null }

type MemoryState = Held[]

const DEFAULT_COLOUR = PROFILE_COLOURS[0]

/**
 * When something last changed, as a stamp.
 *
 * Counted rather than clocked, so a profile changed twice in the same
 * millisecond still changes its picture's address both times.
 */
let ticks = 0

const stamp = (): string => {
  ticks += 1

  return new Date(ticks).toISOString()
}

/**
 * Profiles held in memory, so the routes can be exercised without a database.
 *
 * Behaves as the real one does in the ways the routes depend on: a profile is
 * made on demand for an account that has none, one only belongs to the account
 * that holds it, and moving one to another account keeps the profile itself —
 * which is what keeps somebody's viewing when they leave a shared login.
 */
const createMemoryProfileService = (
  state: MemoryState = [],
): ProfileService & { state: MemoryState } => {
  const listFor = (userId: string): ViewerProfile[] =>
    state.filter((held) => held.userId === userId).map((held) => held.profile)

  const find = (profileId: string): Held | undefined =>
    state.find((held) => held.profile.id === profileId)

  const add = (userId: string, name: string, colour: string, avatar: Avatar): ViewerProfile => {
    const profile: ViewerProfile = {
      id: randomUUID(),
      name,
      colour: PROFILE_COLOURS.find((known) => known === colour) ?? DEFAULT_COLOUR,
      avatar,
      createdAt: stamp(),
      updatedAt: stamp(),
    }

    state.push({ profile, userId, email: `${userId}@flux.local`, photo: null })

    return profile
  }

  return {
    state,

    list: (userId) => Promise.resolve(listFor(userId)),

    ensureDefault: (userId, name) => {
      const [existing] = listFor(userId)

      return Promise.resolve(existing ?? add(userId, name, DEFAULT_COLOUR, { kind: 'initial' }))
    },

    create: (userId, request) =>
      Promise.resolve(
        add(userId, request.name, request.colour, request.avatar ?? { kind: 'initial' }),
      ),

    rename: (userId, profileId, request) => {
      const held = find(profileId)

      if (held === undefined || held.userId !== userId) {
        return Promise.resolve(false)
      }

      held.profile = {
        ...held.profile,
        name: request.name,
        colour: request.colour,
        avatar: request.avatar ?? held.profile.avatar,
        updatedAt: stamp(),
      }

      return Promise.resolve(true)
    },

    remove: (userId, profileId) => {
      // The last one stays, because viewing has to hang on something.
      if (listFor(userId).length <= 1) {
        return Promise.resolve(false)
      }

      const at = state.findIndex((held) => held.profile.id === profileId && held.userId === userId)

      if (at === -1) {
        return Promise.resolve(false)
      }

      state.splice(at, 1)

      return Promise.resolve(true)
    },

    belongsTo: (userId, profileId) =>
      Promise.resolve(find(profileId)?.userId === userId && userId !== ''),

    moveTo: (profileId, newOwnerId) => {
      const held = find(profileId)

      if (held === undefined) {
        return Promise.resolve(false)
      }

      held.userId = newOwnerId
      held.profile = { ...held.profile, updatedAt: stamp() }

      return Promise.resolve(true)
    },

    readAvatar: (profileId) => {
      const held = find(profileId)

      if (held === undefined) {
        return Promise.resolve(null)
      }

      if (held.photo !== null) {
        return Promise.resolve({ body: held.photo, contentType: 'image/webp' })
      }

      const { avatar } = held.profile

      if (avatar.kind !== 'drawn' || !isAvatarStyle(avatar.style)) {
        return Promise.resolve(null)
      }

      return Promise.resolve({
        body: new TextEncoder().encode(drawAvatar(avatar.style, avatar.seed)),
        contentType: 'image/svg+xml',
      })
    },

    listEveryone: () => Promise.resolve(state.map((held) => held.profile)),

    findSignInEmail: (profileId) => Promise.resolve(find(profileId)?.email ?? null),

    savePhoto: (userId, profileId, photo) => {
      const held = find(profileId)

      if (held === undefined || held.userId !== userId) {
        return Promise.resolve(false)
      }

      held.photo = photo.body
      held.profile = {
        ...held.profile,
        avatar: { kind: 'photo', isVideo: photo.contentType.startsWith('video/') },
        updatedAt: stamp(),
      }

      return Promise.resolve(true)
    },
  }
}

export type { Held, MemoryState }

export { createMemoryProfileService }
