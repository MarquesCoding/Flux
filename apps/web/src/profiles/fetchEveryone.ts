import { z } from 'zod'
import { ViewerProfileListSchema } from '@FluxContracts/schemas/ViewerProfile'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'

/**
 * What better-auth answers with when a password is right but not enough.
 */
const TwoFactorPendingSchema = z.object({ twoFactorRedirect: z.literal(true) })

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
): Promise<{ kind: 'signedIn' } | { kind: 'needsCode' } | { kind: 'refused'; reason: string }> => {
  const response = await fetch(`/api/profiles/${profileId}/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => null)

  if (response === null) {
    return { kind: 'refused', reason: 'Flux could not be reached.' }
  }

  if (!response.ok) {
    return { kind: 'refused', reason: 'That password is not right.' }
  }

  // A right password is not always a session. An account with a second factor
  // gets a short-lived cookie and a redirect instead, and is not signed in
  // until a code is accepted.
  // Read as text and parsed here rather than through the router's own reader,
  // which is typed as anything: untrusted input enters through a schema.
  const body = await response.text().catch(() => '')

  return TwoFactorPendingSchema.safeParse(JSON.parse(body === '' ? 'null' : body)).success
    ? { kind: 'needsCode' }
    : { kind: 'signedIn' }
}

export { fetchEveryone, signInAsProfile }
