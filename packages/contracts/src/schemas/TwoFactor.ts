import { z } from 'zod';
import { SessionUserSchema } from './Session';

/**
 * What better-auth returns when two-factor is first enabled.
 *
 * Enabling does not activate the second factor. The account is only protected
 * once a generated code has been verified, which is what stops an operator
 * locking themselves out with a misconfigured authenticator.
 */
const TwoFactorEnableResponseSchema = z.object({
  totpURI: z.string().min(1),
  backupCodes: z.array(z.string().min(1)).min(1),
});

/**
 * What better-auth returns when a code is accepted, both when completing
 * enrollment and when answering a sign-in challenge.
 */
const TwoFactorVerifyResponseSchema = z.object({
  token: z.string().optional(),
  user: SessionUserSchema,
});

const TwoFactorMethodSchema = z.enum(['totp', 'otp']);

export type TwoFactorEnableResponse = z.infer<typeof TwoFactorEnableResponseSchema>;
export type TwoFactorVerifyResponse = z.infer<typeof TwoFactorVerifyResponseSchema>;
export type TwoFactorMethod = z.infer<typeof TwoFactorMethodSchema>;

export { TwoFactorEnableResponseSchema, TwoFactorVerifyResponseSchema, TwoFactorMethodSchema };
