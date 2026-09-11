import { Icon } from '@ValenceUI/Icon';
import { SquareLock02Icon, SquareUnlock02Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { Checkbox } from '@ValenceUI/Checkbox';
import { TextField } from '@ValenceUI/TextField';
import { validateSetupForm, parseOrigins } from './validateSetupForm';
import type { SetupFormErrors, SetupWizardProps } from './SetupWizard.types';

/**
 * Walks whoever opened Valence first through making it theirs: the administrator account, what the
 * server is called, and which origins may reach it. Shown in place of everything else until it is
 * done, because a server with no account on it has nothing else worth showing.
 *
 * @param status - What setup has established so far.
 * @param onComplete - Called once the server is set up and ready to be signed in to.
 */
const SetupWizard = ({ status, onComplete }: SetupWizardProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trustedOrigins, setTrustedOrigins] = useState(status.suggestedTrustedOrigins.join(', '));
  const [cookieSecure, setCookieSecure] = useState(status.isSecureContext);
  const [errors, setErrors] = useState<SetupFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const found = validateSetupForm({ name, email, password, trustedOrigins });

    setErrors(found);

    if (Object.keys(found).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          admin: { name, email, password },
          trustedOrigins: parseOrigins(trustedOrigins),
          cookieSecure,
        }),
      });

      if (!response.ok) {
        setErrors({
          submit:
            response.status === 409
              ? 'This server has already been set up. Reload the page to sign in.'
              : 'Setup could not be completed. Check the details and try again.',
        });

        return;
      }

      onComplete();
    } catch {
      setErrors({ submit: 'Could not reach the server. Check that it is still running.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">Set up Valence</h1>
        <p className="text-text-muted">
          Create the administrator account and confirm how this server is reached.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-text">Administrator</h2>

        <TextField
          label="Name"
          value={name}
          onValueChange={setName}
          autoComplete="name"
          {...(errors.name === undefined ? {} : { error: errors.name })}
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onValueChange={setEmail}
          autoComplete="email"
          {...(errors.email === undefined ? {} : { error: errors.email })}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onValueChange={setPassword}
          autoComplete="new-password"
          description="At least 10 characters."
          {...(errors.password === undefined ? {} : { error: errors.password })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-text">Access</h2>

        <TextField
          label="Trusted origins"
          value={trustedOrigins}
          onValueChange={setTrustedOrigins}
          description={`Detected ${status.detectedOrigin}. Add every address you use to reach Valence, separated by commas.`}
          {...(errors.trustedOrigins === undefined ? {} : { error: errors.trustedOrigins })}
        />

        <Checkbox
          label="This server is reached over HTTPS"
          checked={cookieSecure}
          onCheckedChange={setCookieSecure}
        />

        <p className="flex items-start gap-2 text-sm text-text-muted">
          {cookieSecure ? (
            <Icon of={SquareLock02Icon} size={16} className="mt-0.5 shrink-0" />
          ) : (
            <Icon of={SquareUnlock02Icon} size={16} className="mt-0.5 shrink-0" />
          )}
          {cookieSecure
            ? 'Secure cookies will be used. Login will not work over plain HTTP.'
            : 'Cookies will not be marked secure, so Valence works over plain HTTP on your network.'}
        </p>
      </section>

      {errors.submit === undefined ? null : (
        <p role="alert" className="text-sm text-danger">
          {errors.submit}
        </p>
      )}

      <Button
        isLoading={isSubmitting}
        onClick={() => {
          void submit();
        }}
      >
        Finish setup
      </Button>
    </main>
  );
};

SetupWizard.displayName = 'SetupWizard';

export { SetupWizard };
