import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { TextField } from '@ValenceUI/TextField';
import { verifyBackupCode, verifyTotp } from '@ValenceClient/session/auth';
import type { ChallengeMode, TwoFactorChallengeProps } from './TwoFactorChallenge.types';

const TOTP_LENGTH = 6;

/**
 * Asks for the second step of signing in to an account with two-factor turned on: either the code
 * from an authenticator, or one of the backup codes for anybody who has lost the device holding it.
 *
 * @param onVerified - Called once the second step is accepted.
 */
const TwoFactorChallenge = ({ onVerified }: TwoFactorChallengeProps) => {
  const [mode, setMode] = useState<ChallengeMode>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTotp = mode === 'totp';

  const submit = async () => {
    const trimmed = code.trim();

    if (trimmed.length === 0) {
      setError(isTotp ? 'Enter the code from your authenticator app.' : 'Enter a backup code.');

      return;
    }

    if (isTotp && !/^\d{6}$/.test(trimmed)) {
      setError(`Authenticator codes are ${TOTP_LENGTH.toString()} digits.`);

      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const accepted = isTotp ? await verifyTotp(trimmed) : await verifyBackupCode(trimmed);

      if (!accepted) {
        setError(
          isTotp ? 'That code is not valid. Try the next one.' : 'That backup code is not valid.',
        );

        return;
      }

      onVerified();
    } catch {
      setError('Could not reach the server. Check that it is still running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      noValidate
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
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
          setMode(isTotp ? 'backup' : 'totp');
          setCode('');
          setError(null);
        }}
      >
        {isTotp ? 'Use a backup code instead' : 'Use my authenticator app instead'}
      </Button>
    </form>
  );
};

TwoFactorChallenge.displayName = 'TwoFactorChallenge';

export { TwoFactorChallenge };
