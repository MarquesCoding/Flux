import { z } from 'zod';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import {
  PasskeyRegistrationChallengeSchema,
  PasskeyAuthenticationChallengeSchema,
} from '@FluxContracts/schemas/Passkey';

const PasskeyRegistrationOptionsSchema = z.custom<PublicKeyCredentialCreationOptionsJSON>(
  (value) => PasskeyRegistrationChallengeSchema.safeParse(value).success,
  { message: 'The server sent an unusable passkey registration challenge.' },
);

const PasskeyAuthenticationOptionsSchema = z.custom<PublicKeyCredentialRequestOptionsJSON>(
  (value) => PasskeyAuthenticationChallengeSchema.safeParse(value).success,
  { message: 'The server sent an unusable passkey sign-in challenge.' },
);

export { PasskeyRegistrationOptionsSchema, PasskeyAuthenticationOptionsSchema };
