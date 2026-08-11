import { GetSessionResponseSchema } from '@FluxContracts/schemas/Session'
import type { SessionUser } from '@FluxContracts/schemas/Session'

/**
 * Reads the current session.
 *
 * better-auth answers an unauthenticated request with `200` and a literal
 * `null` body, so a null result means signed out. A thrown error means the
 * server could not be reached, which the caller must distinguish: showing a
 * login form to someone whose server is down sends them round a loop entering
 * credentials that cannot possibly work.
 */
const fetchSession = async (): Promise<SessionUser | null> => {
  const response = await fetch('/api/auth/get-session', {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Session request failed with status ${response.status.toString()}`)
  }

  const parsed = GetSessionResponseSchema.parse(await response.json())

  return parsed === null ? null : parsed.user
}

export { fetchSession }
