import { z } from 'zod';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {
  PasskeyRegistrationChallengeSchema,
  PasskeyAuthenticationChallengeSchema,
} from '@FluxContracts/schemas/Passkey';

/**
 * A WebAuthn registration challenge, validated and typed for the browser API.
 *
 * `z.custom` is used deliberately. The wire shape is checked at runtime by the
 * contract schema, but the parsed value keeps the full
 * `PublicKeyCredentialCreationOptionsJSON` type and every field the server
 * sent. A plain `z.object` would strip whatever the schema does not name,
 * silently discarding options such as `authenticatorSelection` and changing
 * what the authenticator is asked for.
 */
const PasskeyRegistrationOptionsSchema = z.custom<PublicKeyCredentialCreationOptionsJSON>(
  (value) => PasskeyRegistrationChallengeSchema.safeParse(value).success,
  { message: 'The server sent an unusable passkey registration challenge.' },
);

/**
 * A WebAuthn authentication challenge, validated and typed for the browser
 * API. Typed with `z.custom` for the same reason as registration: the parsed
 * value must keep every field the server sent.
 */
const PasskeyAuthenticationOptionsSchema = z.custom<PublicKeyCredentialRequestOptionsJSON>(
  (value) => PasskeyAuthenticationChallengeSchema.safeParse(value).success,
  { message: 'The server sent an unusable passkey sign-in challenge.' },
);

export { PasskeyRegistrationOptionsSchema, PasskeyAuthenticationOptionsSchema };
