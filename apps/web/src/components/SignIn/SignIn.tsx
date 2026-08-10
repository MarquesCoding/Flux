import { useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import TwoFactorChallengeModule from '@FluxWeb/components/TwoFactorChallenge/TwoFactorChallenge'
import TextFieldModule from '@FluxUI/TextField'
import SessionModule from '@FluxContracts/schemas/Session'
import type { SignInErrors, SignInProps } from './SignIn.types'

const { Button } = ButtonModule
const { TextField } = TextFieldModule
const { SignInResponseSchema } = SessionModule
const { TwoFactorChallenge } = TwoFactorChallengeModule

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Password sign-in.
 *
 * Failures are reported as a single "email or password is incorrect" message
 * regardless of which was wrong, so the form cannot be used to discover which
 * email addresses have accounts on this server.
 */
const SignIn = ({ onSignedIn }: SignInProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<SignInErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false)

  const submit = async () => {
    const found: SignInErrors = {}

    if (!EMAIL_PATTERN.test(email)) {
      found.email = 'Enter a valid email address.'
    }

    if (password.length === 0) {
      found.password = 'Enter your password.'
    }

    setErrors(found)

    if (Object.keys(found).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        setErrors({ submit: 'That email or password is incorrect.' })

        return
      }

      const body = SignInResponseSchema.parse(await response.json())

      if ('twoFactorRedirect' in body) {
        setNeedsSecondFactor(true)

        return
      }

      onSignedIn()
    } catch {
      setErrors({ submit: 'Could not reach the server. Check that it is still running.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (needsSecondFactor) {
    return (
      <TwoFactorChallenge
        onVerified={onSignedIn}
        onCancel={() => {
          setNeedsSecondFactor(false)
          setPassword('')
        }}
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">Sign in to Flux</h1>
      </header>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <TextField
          label="Email"
          type="email"
          value={email}
          onValueChange={setEmail}
          autoComplete="username"
          {...(errors.email === undefined ? {} : { error: errors.email })}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onValueChange={setPassword}
          autoComplete="current-password"
          {...(errors.password === undefined ? {} : { error: errors.password })}
        />

        {errors.submit === undefined ? null : (
          <p role="alert" className="text-sm text-danger">
            {errors.submit}
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </main>
  )
}

SignIn.displayName = 'SignIn'

export default { SignIn }
