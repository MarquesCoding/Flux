import { z } from 'zod';

const PasskeySchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  deviceType: z.string().nullish(),
  backedUp: z.boolean().nullish(),
  createdAt: z.string().nullish(),
});

const PasskeyListSchema = z.array(PasskeySchema);

const PasskeyRegistrationChallengeSchema = z.object({
  challenge: z.string().min(1),
  rp: z.object({ name: z.string().min(1), id: z.string().optional() }),
  user: z.object({ id: z.string().min(1), name: z.string(), displayName: z.string() }),
  pubKeyCredParams: z.array(z.object({ alg: z.number(), type: z.literal('public-key') })).min(1),
});

const PasskeyAuthenticationChallengeSchema = z.object({
  challenge: z.string().min(1),
  rpId: z.string().optional(),
  timeout: z.number().optional(),
  userVerification: z.string().optional(),
});

export type Passkey = z.infer<typeof PasskeySchema>;

export {
  PasskeySchema,
  PasskeyListSchema,
  PasskeyRegistrationChallengeSchema,
  PasskeyAuthenticationChallengeSchema,
};
