import { z } from 'zod'

/**
 * A registered passkey, as listed by better-auth.
 *
 * `name` is user-supplied and optional, so the interface must fall back to
 * something meaningful rather than rendering an empty row.
 */
const PasskeySchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  deviceType: z.string().nullish(),
  backedUp: z.boolean().nullish(),
  createdAt: z.string().nullish(),
})

const PasskeyListSchema = z.array(PasskeySchema)

/**
 * The fields of a WebAuthn registration challenge that Flux checks before
 * handing it to the authenticator.
 *
 * This deliberately does not mirror the whole `PublicKeyCredentialCreationOptionsJSON`
 * type. That type is large, spec-tracking, and would rot; what matters is that
 * a challenge, a relying party, a user handle and at least one algorithm are
 * present before a device is asked to mint a credential.
 */
const PasskeyRegistrationChallengeSchema = z.object({
  challenge: z.string().min(1),
  rp: z.object({ name: z.string().min(1), id: z.string().optional() }),
  user: z.object({ id: z.string().min(1), name: z.string(), displayName: z.string() }),
  pubKeyCredParams: z.array(z.object({ alg: z.number(), type: z.literal('public-key') })).min(1),
})

/**
 * The fields of a WebAuthn authentication challenge that Flux checks before
 * asking the authenticator to sign.
 *
 * better-auth issues no `allowCredentials`, so sign-in relies on discoverable
 * credentials: the user picks an account from their device rather than typing
 * an email first.
 */
const PasskeyAuthenticationChallengeSchema = z.object({
  challenge: z.string().min(1),
  rpId: z.string().optional(),
  timeout: z.number().optional(),
  userVerification: z.string().optional(),
})

export type Passkey = z.infer<typeof PasskeySchema>

export {
  PasskeySchema,
  PasskeyListSchema,
  PasskeyRegistrationChallengeSchema,
  PasskeyAuthenticationChallengeSchema,
}
