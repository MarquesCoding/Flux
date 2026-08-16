import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { PasskeyAuthenticationOptionsSchema } from './PasskeyOptions';

type AuthenticateOutcome =
  { kind: 'signedIn' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string };

const CANCELLED_ERRORS = new Set(['NotAllowedError', 'AbortError']);

/**
 * Reads the challenge the server issued, through a schema — this is handed straight to the browser's
 * credential machinery, which is not somewhere to pass an unchecked object.
 *
 * @param response - The server's answer.
 * @returns The challenge to sign.
 */
const readChallenge = async (response: Response): Promise<PublicKeyCredentialRequestOptionsJSON> =>
  PasskeyAuthenticationOptionsSchema.parse(await response.json());

/**
 * Signs in with a passkey: asks the server for a challenge, has the browser sign it with whatever
 * credential the person chooses, and hands the result back to be checked. The password is never
 * involved, and nothing secret leaves the device.
 */
const authenticateWithPasskey = async (): Promise<AuthenticateOutcome> => {
  try {
    const optionsResponse = await fetch('/api/auth/passkey/generate-authenticate-options', {
      headers: { accept: 'application/json' },
    });

    if (!optionsResponse.ok) {
      return { kind: 'failed', reason: 'The server would not start passkey sign in.' };
    }

    const optionsJSON = await readChallenge(optionsResponse);

    const assertion = await startAuthentication({ optionsJSON });

    const verifyResponse = await fetch('/api/auth/passkey/verify-authentication', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    });

    if (!verifyResponse.ok) {
      return { kind: 'failed', reason: 'That passkey was not accepted.' };
    }

    return { kind: 'signedIn' };
  } catch (error) {
    if (error instanceof Error && CANCELLED_ERRORS.has(error.name)) {
      return { kind: 'cancelled' };
    }

    return { kind: 'failed', reason: 'Your device could not use a passkey here.' };
  }
};

export { authenticateWithPasskey };
