import { z } from 'zod';
import { SessionUserSchema } from './Session';

const TwoFactorEnableResponseSchema = z.object({
  totpURI: z.string().min(1),
  backupCodes: z.array(z.string().min(1)).min(1),
});

const TwoFactorVerifyResponseSchema = z.object({
  token: z.string().optional(),
  user: SessionUserSchema,
});

const TwoFactorMethodSchema = z.enum(['totp', 'otp']);

export type TwoFactorEnableResponse = z.infer<typeof TwoFactorEnableResponseSchema>;
export type TwoFactorVerifyResponse = z.infer<typeof TwoFactorVerifyResponseSchema>;
export type TwoFactorMethod = z.infer<typeof TwoFactorMethodSchema>;

export { TwoFactorEnableResponseSchema, TwoFactorVerifyResponseSchema, TwoFactorMethodSchema };
