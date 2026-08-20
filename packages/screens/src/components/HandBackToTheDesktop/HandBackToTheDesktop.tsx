import { useEffect, useState } from 'react';
import { Logo } from '@FluxUI/Logo';
import { Spinner } from '@FluxUI/Spinner';
import { handThisSessionToTheDesktop, sendThemBackToTheirDesktop } from '@FluxClient/session/auth';
import type { Handover } from '@FluxCore/functions/electronHandover';

type HandBackToTheDesktopProps = { carried: Handover };

/**
 * Sends an already signed-in somebody straight back to the desktop client that sent them here.
 *
 * Signing in mints the code that carries somebody home, which covers the person who had to sign in.
 * It does not cover the person who was already signed in in this browser — which is most people,
 * because this is the browser they use Flux in. They would otherwise arrive, be shown their library,
 * and wonder why the application they came from never came back.
 *
 * The screen says what is happening rather than flashing, because asking for the code and following
 * it are two round trips and a blank moment in a browser somebody did not open themselves is
 * alarming.
 *
 * @param carried - What the desktop client sent them here with.
 */
const HandBackToTheDesktop = ({ carried }: HandBackToTheDesktopProps) => {
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    let stopWatching: (() => void) | null = null;

    void handThisSessionToTheDesktop(carried).then((minted) => {
      if (!minted) {
        setRefused(true);

        return;
      }

      stopWatching = sendThemBackToTheirDesktop();
    });

    return () => {
      stopWatching?.();
    };
  }, [carried]);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-5">
        <Logo className="h-8 self-start" />

        {refused ? (
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-medium text-text">That did not work</h1>
            <p className="text-sm text-text-muted">
              Flux could not hand this session to the application. Try signing in from the
              application again.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Spinner size="sm" label="Returning you to Flux" />
            <p className="text-sm text-text-muted">Taking you back to Flux…</p>
          </div>
        )}
      </div>
    </main>
  );
};

HandBackToTheDesktop.displayName = 'HandBackToTheDesktop';

export { HandBackToTheDesktop };
