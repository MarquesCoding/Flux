import { useState } from 'react'
import ButtonModule from '@FluxUI/Button'
import TextFieldModule from '@FluxUI/TextField'
import type { ChallengeMode, TwoFactorChallengeProps } from './TwoFactorChallenge.types'

const { Button } = ButtonModule
const { TextField } = TextFieldModule

const TOTP_LENGTH = 6

const ENDPOINTS: Record<ChallengeMode, string> = {
  totp: '/api/auth/two-factor/verify-totp',
  backup: '/api/auth/two-factor/verify-backup-code',
}

/**
 * The second step of signing in to an account with two-factor enrolled.
 *
 * better-auth issues a short-lived two-factor cookie alongside the
 * `twoFactorRedirect` response, and this request completes the sign-in against
 * it. No session exists until a code is accepted.
 *
 * Carries no layout of its own: it appears under a portrait on the way in,
 * where the screen has already said who is being asked and offers its own way
 * back. A component that brings a page with it can only ever be a page.
 */
const TwoFactorChallenge = ({ onVerified }: TwoFactorChallengeProps) => {
  const [mode, setMode] = useState<ChallengeMode>('totp')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isTotp = mode === 'totp'

  const submit = async () => {
    const trimmed = code.trim()

    if (trimmed.length === 0) {
      setError(isTotp ? 'Enter the code from your authenticator app.' : 'Enter a backup code.')

      return
    }

    if (isTotp && !/^\d{6}$/.test(trimmed)) {
      setError(`Authenticator codes are ${TOTP_LENGTH.toString()} digits.`)

      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(ENDPOINTS[mode], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })

      if (!response.ok) {
        setError(
          isTotp ? 'That code is not valid. Try the next one.' : 'That backup code is not valid.',
        )

        return
      }

      onVerified()
    } catch {
      setError('Could not reach the server. Check that it is still running.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      noValidate
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <p className="text-center text-sm text-text-muted">
        {isTotp
          ? 'Enter the current code from your authenticator app.'
          : 'Enter one of the backup codes you saved. Each can be used once.'}
      </p>

      <TextField
        label={isTotp ? 'Authenticator code' : 'Backup code'}
        value={code}
        onValueChange={setCode}
        autoComplete="one-time-code"
        placeholder={isTotp ? '123456' : ''}
        size="lg"
        isPill
        {...(error === null ? {} : { error })}
      />

      <Button type="submit" variant="glossy" size="lg" isPill isLoading={isSubmitting}>
        Verify
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        isPill
        onClick={() => {
          setMode(isTotp ? 'backup' : 'totp')
          setCode('')
          setError(null)
        }}
      >
        {isTotp ? 'Use a backup code instead' : 'Use my authenticator app instead'}
      </Button>
    </form>
  )
}

TwoFactorChallenge.displayName = 'TwoFactorChallenge'

export default { TwoFactorChallenge }
