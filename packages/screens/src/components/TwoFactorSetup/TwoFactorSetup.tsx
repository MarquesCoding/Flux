import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { QrCode } from '@FluxUI/QrCode';
import { TextField } from '@FluxUI/TextField';
import { disableTwoFactor, enableTwoFactor, verifyTotp } from '@FluxClient/session/auth';
import { readTotpSecret, formatTotpSecret } from './readTotpSecret';
import type { Enrollment, SetupStage, TwoFactorSetupProps } from './TwoFactorSetup.types';

/**
 * Turns two-factor on and off for an account. Enrolling asks for the password again, shows the secret
 * as both a code to scan and characters to type, and hands over the backup codes once — anyone who
 * loses both their authenticator and those codes loses the account.
 *
 * @param isEnabled - Whether two-factor is on at the moment.
 * @param onChanged - Called after it is turned on or off.
 */
const TwoFactorSetup = ({ isEnabled, onChanged }: TwoFactorSetupProps) => {
  const [stage, setStage] = useState<SetupStage>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setStage('idle');
    setPassword('');
    setCode('');
    setEnrollment(null);
    setError(null);
  };

  const begin = async () => {
    if (password.length === 0) {
      setError('Enter your password to continue.');

      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      const started = await enableTwoFactor(password);

      if (started === null) {
        setError('That password is incorrect.');

        return;
      }

      setEnrollment({
        totpURI: started.totpURI,
        secret: readTotpSecret(started.totpURI),
        backupCodes: started.backupCodes,
      });
      setPassword('');
      setStage('showSecret');
    } catch {
      setError('Could not reach the server. Check that it is still running.');
    } finally {
      setIsBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Authenticator codes are 6 digits.');

      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      if (!(await verifyTotp(code.trim()))) {
        setError('That code is not valid. Try the next one.');

        return;
      }

      reset();
      onChanged();
    } catch {
      setError('Could not reach the server. Check that it is still running.');
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async () => {
    if (password.length === 0) {
      setError('Enter your password to continue.');

      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      if (!(await disableTwoFactor(password))) {
        setError('That password is incorrect.');

        return;
      }

      reset();
      onChanged();
    } catch {
      setError('Could not reach the server. Check that it is still running.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-text">Two-factor authentication</h2>
        <p className="text-sm text-text-muted">
          {isEnabled
            ? 'Your account asks for a code from your authenticator app when you sign in.'
            : 'Add a code from an authenticator app to your sign in.'}
        </p>
      </header>

      {error === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {stage === 'idle' && !isEnabled ? (
        <Button
          onClick={() => {
            setStage('confirmPassword');
          }}
        >
          Set up two-factor
        </Button>
      ) : null}

      {stage === 'idle' && isEnabled ? (
        <Button
          variant="secondary"
          onClick={() => {
            setStage('disable');
          }}
        >
          Turn off two-factor
        </Button>
      ) : null}

      {stage === 'confirmPassword' || stage === 'disable' ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (stage === 'disable' ? disable() : begin());
          }}
        >
          <TextField
            label="Password"
            type="password"
            value={password}
            onValueChange={setPassword}
            autoComplete="current-password"
            description="Confirm it is you before changing sign in requirements."
          />

          <div className="flex gap-2">
            <Button type="submit" isLoading={isBusy}>
              Continue
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {stage === 'showSecret' && enrollment !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Scan this with your authenticator app, or enter the key by hand.
          </p>

          <QrCode value={enrollment.totpURI} label="Two-factor setup QR code" />

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">Setup key</span>
            <code className="rounded-md bg-surface-raised px-3 py-2 font-mono text-sm text-text">
              {formatTotpSecret(enrollment.secret)}
            </code>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">Backup codes</span>
            <p className="text-sm text-text-muted">
              Save these now. Each works once if you lose your authenticator, and they are not shown
              again.
            </p>
            <ul className="grid grid-cols-2 gap-1 rounded-md bg-surface-raised p-3 font-mono text-sm text-text">
              {enrollment.backupCodes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>
          </div>

          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <TextField
              label="Authenticator code"
              value={code}
              onValueChange={setCode}
              autoComplete="one-time-code"
              placeholder="123456"
              description="Enter a code from your app to finish. Two-factor is not on until you do."
            />

            <div className="flex gap-2">
              <Button type="submit" isLoading={isBusy}>
                Turn on two-factor
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
};

TwoFactorSetup.displayName = 'TwoFactorSetup';

export { TwoFactorSetup };
