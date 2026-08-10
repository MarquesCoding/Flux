import type { Avatar, ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

type ProfileRequest = {
  name: string
  colour: ProfileColour
  /**
   * Absent to keep whatever the profile already wears.
   */
  avatar?: Avatar
}

/**
 * The people using one account.
 *
 * A port rather than the database directly, so the routes can be exercised
 * without one.
 */
type ProfileService = {
  list: (userId: string) => Promise<ViewerProfile[]>
  /**
   * The profile an account falls back to.
   *
   * Made on demand rather than at sign-up, because an account that never adds
   * anybody should not carry a picker it has no use for. Whoever is watching
   * is a person either way, and their viewing has to hang on something.
   */
  ensureDefault: (userId: string, name: string) => Promise<ViewerProfile>
  create: (userId: string, request: ProfileRequest) => Promise<ViewerProfile>
  rename: (userId: string, profileId: string, request: ProfileRequest) => Promise<boolean>
  remove: (userId: string, profileId: string) => Promise<boolean>
  /**
   * Whether this profile belongs to this account.
   *
   * Checked on every request that names one. A profile identifier is not a
   * secret — it travels in a header and sits in local storage — so it grants
   * nothing on its own.
   */
  belongsTo: (userId: string, profileId: string) => Promise<boolean>
  /**
   * Hands a profile to an account of its own.
   *
   * The person keeps everything they have watched, because progress hangs on
   * the profile rather than on whoever was hosting it. This is the intended
   * way out of a shared account: somebody who started as a name on a
   * housemate's login ends up with their own, without losing their place in
   * anything.
   */
  moveTo: (profileId: string, newOwnerId: string) => Promise<boolean>
  /**
   * Reads a profile's picture, drawing it if it is a drawn one.
   *
   * Answers with the bytes and what they are, so the route can serve either an
   * uploaded photograph or a generated face without knowing which it asked
   * for.
   */
  readAvatar: (profileId: string) => Promise<{ body: Uint8Array; contentType: string } | null>
  /**
   * Stores a photograph somebody uploaded for a profile.
   */
  savePhoto: (
    userId: string,
    profileId: string,
    photo: { body: Uint8Array; contentType: string },
  ) => Promise<boolean>
}

export type { ProfileRequest, ProfileService }

export default {}
