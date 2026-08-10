import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import type { Avatar, ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { ViewerProfileListSchema } = ViewerProfileModule

/**
 * The people using this account.
 *
 * Answers with nothing rather than throwing, like every other read a page
 * makes: a picker that cannot load is a picker that shows nobody, not a page
 * that fails.
 */
const fetchProfiles = async (): Promise<ViewerProfile[]> => {
  try {
    const response = await fetch('/api/profiles', { headers: { accept: 'application/json' } })

    if (!response.ok) {
      return []
    }

    return ViewerProfileListSchema.parse(await response.json()).profiles
  } catch {
    return []
  }
}

/**
 * Adds somebody to this account.
 */
const createProfile = async (
  name: string,
  colour: ProfileColour,
  avatar?: Avatar,
): Promise<boolean> => {
  const response = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(avatar === undefined ? { name, colour } : { name, colour, avatar }),
  }).catch(() => null)

  return response !== null && response.ok
}

/**
 * Changes what a profile is called and what it looks like.
 */
const saveProfile = async (
  profileId: string,
  name: string,
  colour: ProfileColour,
  avatar?: Avatar,
): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(avatar === undefined ? { name, colour } : { name, colour, avatar }),
  }).catch(() => null)

  return response !== null && response.ok
}

/**
 * Uploads somebody's own photograph for a profile.
 *
 * Sent as the picture itself rather than as a form: there is one file and no
 * other fields, and multipart would be ceremony around a single body.
 */
const uploadProfilePhoto = async (profileId: string, file: File): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}/photo`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  }).catch(() => null)

  return response !== null && response.ok
}

/**
 * Removes somebody from this account, and their viewing with them.
 */
const removeProfile = async (profileId: string): Promise<boolean> => {
  const response = await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' }).catch(() => null)

  return response !== null && response.ok
}

export default { fetchProfiles, createProfile, saveProfile, removeProfile, uploadProfilePhoto }
