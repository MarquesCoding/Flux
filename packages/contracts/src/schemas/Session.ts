import { z } from 'zod';

const SessionUserSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  role: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
});

const GetSessionResponseSchema = z
  .object({
    user: SessionUserSchema,
  })
  .nullable();

const SignInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignInResponseSchema = z.union([
  z.object({
    twoFactorRedirect: z.literal(true),
    twoFactorMethods: z.array(z.string()).optional(),
  }),
  z.object({
    redirect: z.boolean().optional(),
    token: z.string().optional(),
    user: SessionUserSchema,
  }),
]);

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>;
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;

export { SessionUserSchema, GetSessionResponseSchema, SignInRequestSchema, SignInResponseSchema };
