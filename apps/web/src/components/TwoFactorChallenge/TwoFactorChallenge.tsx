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
 */
const TwoFactorChallenge = ({ onVerified, onCancel }: TwoFactorChallengeProps) => {
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">Two-factor authentication</h1>
        <p className="text-text-muted">
          {isTotp
            ? 'Enter the current code from your authenticator app.'
            : 'Enter one of the backup codes you saved. Each can be used once.'}
        </p>
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
          label={isTotp ? 'Authenticator code' : 'Backup code'}
          value={code}
          onValueChange={setCode}
          autoComplete="one-time-code"
          placeholder={isTotp ? '123456' : ''}
          {...(error === null ? {} : { error })}
        />

        <Button type="submit" isLoading={isSubmitting}>
          Verify
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMode(isTotp ? 'backup' : 'totp')
            setCode('')
            setError(null)
          }}
        >
          {isTotp ? 'Use a backup code instead' : 'Use my authenticator app instead'}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Back to sign in
        </Button>
      </form>
    </main>
  )
}

TwoFactorChallenge.displayName = 'TwoFactorChallenge'

export default { TwoFactorChallenge }
