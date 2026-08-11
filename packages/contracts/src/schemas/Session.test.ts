import { describe, expect, it } from 'vitest'
import { GetSessionResponseSchema, SignInResponseSchema } from './Session'

const user = {
  id: 'usr_1',
  name: 'Operator',
  email: 'admin@flux.test',
  emailVerified: false,
}

describe('GetSessionResponseSchema', () => {
  it('treats a null body as signed out', () => {
    expect(GetSessionResponseSchema.parse(null)).toBeNull()
  })

  it('accepts a session body', () => {
    expect(GetSessionResponseSchema.parse({ user })).toMatchObject({
      user: { email: 'admin@flux.test' },
    })
  })

  it('ignores the extra fields better-auth returns alongside the user', () => {
    const parsed = GetSessionResponseSchema.parse({
      user: { ...user, createdAt: '2026-08-09T00:00:00.000Z', twoFactorEnabled: false },
      session: { token: 'abc', expiresAt: '2026-09-09T00:00:00.000Z' },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.user.twoFactorEnabled).toBe(false)
  })

  it('rejects a user with no email', () => {
    expect(() => GetSessionResponseSchema.parse({ user: { ...user, email: undefined } })).toThrow()
  })
})

describe('SignInResponseSchema', () => {
  it('accepts a successful sign in', () => {
    const parsed = SignInResponseSchema.parse({ redirect: false, token: 'abc', user })

    expect(parsed).toMatchObject({ user: { email: 'admin@flux.test' } })
  })

  it('accepts a two factor challenge', () => {
    expect(SignInResponseSchema.parse({ twoFactorRedirect: true })).toEqual({
      twoFactorRedirect: true,
    })
  })

  it('rejects a body that is neither', () => {
    expect(() => SignInResponseSchema.parse({ redirect: false })).toThrow()
  })
})
