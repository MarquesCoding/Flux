import { startAuthentication } from '@simplewebauthn/browser'
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { PasskeyAuthenticationOptionsSchema } from './PasskeyOptions'

type AuthenticateOutcome =
  { kind: 'signedIn' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string }

const CANCELLED_ERRORS = new Set(['NotAllowedError', 'AbortError'])

const readChallenge = async (response: Response): Promise<PublicKeyCredentialRequestOptionsJSON> =>
  PasskeyAuthenticationOptionsSchema.parse(await response.json())

/**
 * Signs in with a passkey.
 *
 * The server issues no `allowCredentials`, so this is a discoverable
 * credential flow: the user chooses an account on their device and never types
 * an email address. The challenge is held server-side against a cookie set by
 * the options request, so both requests must be made from the same origin in
 * the same session.
 *
 * A dismissed prompt is `cancelled`, not a failure. Someone who opens the
 * passkey sheet and changes their mind should be returned to the password form
 * without being told anything went wrong.
 */
const authenticateWithPasskey = async (): Promise<AuthenticateOutcome> => {
  try {
    const optionsResponse = await fetch('/api/auth/passkey/generate-authenticate-options', {
      headers: { accept: 'application/json' },
    })

    if (!optionsResponse.ok) {
      return { kind: 'failed', reason: 'The server would not start passkey sign in.' }
    }

    const optionsJSON = await readChallenge(optionsResponse)

    const assertion = await startAuthentication({ optionsJSON })

    const verifyResponse = await fetch('/api/auth/passkey/verify-authentication', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    })

    if (!verifyResponse.ok) {
      return { kind: 'failed', reason: 'That passkey was not accepted.' }
    }

    return { kind: 'signedIn' }
  } catch (error) {
    if (error instanceof Error && CANCELLED_ERRORS.has(error.name)) {
      return { kind: 'cancelled' }
    }

    return { kind: 'failed', reason: 'Your device could not use a passkey here.' }
  }
}

export type { AuthenticateOutcome }

export { authenticateWithPasskey }
