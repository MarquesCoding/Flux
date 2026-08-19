import { useEffect, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Logo } from '@FluxUI/Logo';
import { Spinner } from '@FluxUI/Spinner';
import { platformInUse } from '@FluxClient/platform/installPlatform';
import type { SignInThroughYourBrowserProps } from './SignInThroughYourBrowser.types';

/**
 * Sends somebody to their own browser to sign in, for a client whose window cannot hold a cookie.
 *
 * Everything about signing in already works in a browser — a saved password, a passkey, an
 * authenticator app — and none of it is worth rebuilding badly in a window that a browser engine
 * treats as a stranger to the server. So the ceremony happens where it works, and what returns is a
 * single-use code the application never sees.
 *
 * The screen stays until the account has actually arrived rather than the moment the browser opens,
 * because opening a browser is not signing in and somebody may close the tab.
 *
 * @param onSignedIn - Told once an account has arrived.
 * @param onChangeServer - Told when somebody wants a different Flux instead.
 */
const SignInThroughYourBrowser = ({
  onSignedIn,
  onChangeServer,
}: SignInThroughYourBrowserProps) => {
  const [waiting, setWaiting] = useState(false);
  const signIn = platformInUse().signInElsewhere;

  useEffect(() => signIn?.whenDone(onSignedIn), [signIn, onSignedIn]);

  if (signIn === null) {
    return null;
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="h-8 self-start" />

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium text-text">Sign in to Flux</h1>
          <p className="text-sm text-text-muted">
            {waiting
              ? 'Finish signing in in your browser, and this window will carry on by itself.'
              : 'Your browser opens on your server, so your saved password, passkey and codes all work as usual.'}
          </p>
        </div>

        <Button
          onClick={() => {
            setWaiting(true);
            void signIn.start();
          }}
          disabled={waiting}
        >
          {waiting ? <Spinner size="sm" label="Waiting for your browser" /> : null}
          {waiting ? 'Waiting for your browser' : 'Open my browser'}
        </Button>

        <Button variant="ghost" onClick={onChangeServer}>
          Use a different server
        </Button>
      </div>
    </main>
  );
};

SignInThroughYourBrowser.displayName = 'SignInThroughYourBrowser';

export { SignInThroughYourBrowser };
