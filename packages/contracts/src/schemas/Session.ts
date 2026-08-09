import { z } from 'zod'

const SessionUserSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  role: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
})

/**
 * The body better-auth returns from `GET /api/auth/get-session`.
 *
 * An unauthenticated request is answered with `200` and a literal `null` body
 * rather than a `401`, so callers must treat null as "signed out" and reserve
 * error handling for transport failures.
 */
const GetSessionResponseSchema = z
  .object({
    user: SessionUserSchema,
  })
  .nullable()

const SignInRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * The body better-auth returns from a successful password sign-in.
 *
 * `twoFactorRedirect` appears instead of a user when the account has verified
 * two-factor enrolled, in which case no session is issued until the second
 * factor is presented.
 */
const SignInResponseSchema = z.union([
  z.object({ twoFactorRedirect: z.literal(true) }),
  z.object({
    redirect: z.boolean().optional(),
    token: z.string().optional(),
    user: SessionUserSchema,
  }),
])

export type SessionUser = z.infer<typeof SessionUserSchema>
export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>
export type SignInRequest = z.infer<typeof SignInRequestSchema>
export type SignInResponse = z.infer<typeof SignInResponseSchema>

export default {
  SessionUserSchema,
  GetSessionResponseSchema,
  SignInRequestSchema,
  SignInResponseSchema,
}
