import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IconKey } from '@tabler/icons-react'
import MoodBackgroundModule from '@FluxUI/MoodBackground'
import revealModule from '@FluxUI/animations/reveal'
import ButtonModule from '@FluxUI/Button'
import TwoFactorChallengeModule from '@FluxWeb/components/TwoFactorChallenge/TwoFactorChallenge'
import TextFieldModule from '@FluxUI/TextField'
import SessionModule from '@FluxContracts/schemas/Session'
import isPasskeySupportedModule from '@FluxWeb/passkeys/isPasskeySupported'
import authenticateWithPasskeyModule from '@FluxWeb/passkeys/authenticateWithPasskey'
import type { SignInErrors, SignInProps } from './SignIn.types'

const { Button } = ButtonModule
const { MoodBackground } = MoodBackgroundModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { TextField } = TextFieldModule
const { SignInResponseSchema } = SessionModule
const { TwoFactorChallenge } = TwoFactorChallengeModule
const { isPasskeySupported } = isPasskeySupportedModule
const { authenticateWithPasskey } = authenticateWithPasskeyModule

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The way in.
 *
 * Composed like the rest of the application rather than as a form on a blank
 * page: the same wash, the same typography and the same arrival, so signing in
 * reads as the first screen of Flux instead of a gate in front of it.
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
  const [isUsingPasskey, setIsUsingPasskey] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const passkeysAvailable = isPasskeySupported()

  const signInWithPasskey = async () => {
    setErrors({})
    setIsUsingPasskey(true)

    try {
      const outcome = await authenticateWithPasskey()

      if (outcome.kind === 'failed') {
        setErrors({ submit: outcome.reason })

        return
      }

      if (outcome.kind === 'cancelled') {
        return
      }

      onSignedIn()
    } finally {
      setIsUsingPasskey(false)
    }
  }

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
    <main className="relative flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <MoodBackground color={null} hasGrid />

      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="shown"
        className="flex w-full max-w-sm flex-col gap-8"
      >
        <motion.header
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion, 'heavy')}
          className="flex flex-col gap-2"
        >
          <h1 className="bg-gradient-to-br from-text via-text to-accent bg-clip-text text-[clamp(2.5rem,9vw,4rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-transparent">
            Flux
          </h1>

          <p className="text-sm text-text-muted">Sign in to carry on watching.</p>
        </motion.header>

        <motion.form
          noValidate
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion)}
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

          <Button type="submit" variant="glossy" size="lg" isPill isLoading={isSubmitting}>
            Sign in
          </Button>
        </motion.form>

        {passkeysAvailable ? (
          <motion.div
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex flex-col gap-4"
          >
            {/* A rule with a word in it rather than a word on its own: the line
              is what says these are two ways of doing one thing. */}
            <span className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-text-muted">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </span>

            <Button
              variant="secondary"
              size="lg"
              isPill
              isLoading={isUsingPasskey}
              onClick={() => {
                void signInWithPasskey()
              }}
            >
              <IconKey size={18} aria-hidden />
              Use a passkey
            </Button>
          </motion.div>
        ) : null}
      </motion.div>
    </main>
  )
}

SignIn.displayName = 'SignIn'

export default { SignIn }
