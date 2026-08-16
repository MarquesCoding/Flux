import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { PasskeyRegistrationOptionsSchema } from './PasskeyOptions';

type RegisterOutcome =
  { kind: 'registered' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string };

const CANCELLED_ERRORS = new Set(['NotAllowedError', 'AbortError']);

/**
 * Reads the enrollment challenge the server issued, through a schema — this is handed straight to
 * the browser's credential machinery, which is not somewhere to pass an unchecked object.
 *
 * @param response - The server's answer.
 * @returns The challenge to enrol against.
 */
const readChallenge = async (response: Response): Promise<PublicKeyCredentialCreationOptionsJSON> =>
  PasskeyRegistrationOptionsSchema.parse(await response.json());

/**
 * Runs the browser's registration ceremony and hands the result to the server, which is how a device
 * becomes something somebody can sign in with instead of a password.
 *
 * @param name - What to call this device in the list of passkeys.
 * @returns Whether it worked, and why not where it did not.
 */
const registerPasskey = async (name: string): Promise<RegisterOutcome> => {
  try {
    const optionsResponse = await fetch('/api/auth/passkey/generate-register-options', {
      headers: { accept: 'application/json' },
    });

    if (!optionsResponse.ok) {
      return { kind: 'failed', reason: 'The server would not start passkey registration.' };
    }

    const optionsJSON = await readChallenge(optionsResponse);

    const attestation = await startRegistration({ optionsJSON });

    const verifyResponse = await fetch('/api/auth/passkey/verify-registration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: attestation, name }),
    });

    if (!verifyResponse.ok) {
      return { kind: 'failed', reason: 'The server rejected the new passkey.' };
    }

    return { kind: 'registered' };
  } catch (error) {
    if (error instanceof Error && CANCELLED_ERRORS.has(error.name)) {
      return { kind: 'cancelled' };
    }

    return { kind: 'failed', reason: 'Your device could not create a passkey.' };
  }
};

export { registerPasskey };
