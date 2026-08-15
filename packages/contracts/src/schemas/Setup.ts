import { z } from 'zod';

const SetupStatusSchema = z.object({
  isComplete: z.boolean(),
  detectedOrigin: z.string(),
  isSecureContext: z.boolean(),
  suggestedTrustedOrigins: z.array(z.string()),
});

const SetupAdminSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(10),
});

const SetupRequestSchema = z.object({
  admin: SetupAdminSchema,
  trustedOrigins: z.array(z.string().url()).min(1),
  cookieSecure: z.boolean(),
});

const SetupResultSchema = z.object({
  isComplete: z.literal(true),
  restartRequired: z.boolean(),
});

const SetupErrorSchema = z.object({ error: z.string() });

export type SetupStatus = z.infer<typeof SetupStatusSchema>;
export type SetupAdmin = z.infer<typeof SetupAdminSchema>;
export type SetupRequest = z.infer<typeof SetupRequestSchema>;
export type SetupResult = z.infer<typeof SetupResultSchema>;

export {
  SetupStatusSchema,
  SetupAdminSchema,
  SetupRequestSchema,
  SetupResultSchema,
  SetupErrorSchema,
};
