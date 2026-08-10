import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

const { ViewerProfileListSchema } = ViewerProfileModule

/**
 * Everybody who could sign in here.
 *
 * Read before anybody has, because it is the way in: a wall of faces rather
 * than a box asking for an address. Names and pictures only — the server never
 * sends an address to a page nobody has signed into.
 */
const fetchEveryone = async (): Promise<ViewerProfile[]> => {
  try {
    const response = await fetch('/api/profiles/everyone', {
      headers: { accept: 'application/json' },
    })

    if (!response.ok) {
      return []
    }

    return ViewerProfileListSchema.parse(await response.json()).profiles
  } catch {
    return []
  }
}

/**
 * Signs somebody in by the face they picked.
 *
 * Answers with why it failed rather than with nothing, because the one thing a
 * person needs here is to know whether it was the password.
 */
const signInAsProfile = async (
  profileId: string,
  password: string,
): Promise<{ kind: 'signedIn' } | { kind: 'refused'; reason: string }> => {
  const response = await fetch(`/api/profiles/${profileId}/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => null)

  if (response === null) {
    return { kind: 'refused', reason: 'Flux could not be reached.' }
  }

  return response.ok
    ? { kind: 'signedIn' }
    : { kind: 'refused', reason: 'That password is not right.' }
}

export default { fetchEveryone, signInAsProfile }
