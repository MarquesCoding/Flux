import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import type { ProfileColour, ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

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
const createProfile = async (name: string, colour: ProfileColour): Promise<boolean> => {
  const response = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, colour }),
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

export default { fetchProfiles, createProfile, removeProfile }
