import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { PasskeyRegistrationOptionsSchema } from './PasskeyOptions';

type RegisterOutcome =
  { kind: 'registered' } | { kind: 'cancelled' } | { kind: 'failed'; reason: string };

const CANCELLED_ERRORS = new Set(['NotAllowedError', 'AbortError']);

const readChallenge = async (response: Response): Promise<PublicKeyCredentialCreationOptionsJSON> =>
  PasskeyRegistrationOptionsSchema.parse(await response.json());

/**
 * Runs the WebAuthn registration ceremony and hands the result to the server.
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

export type { RegisterOutcome };

export { registerPasskey };
