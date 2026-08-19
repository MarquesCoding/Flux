import { useState } from 'react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { Logo } from '@FluxUI/Logo';
import { Spinner } from '@FluxUI/Spinner';
import { readServerAddress } from '@FluxClient/session/readServerAddress';
import { reachServer } from './reachServer';
import type { ConnectToServerProps } from './ConnectToServer.types';

/**
 * Asks which Flux this client is for, which a client that serves its own pages has no way of
 * knowing and a browser never has to ask.
 *
 * The address is tried before it is kept. A typo that is only discovered at the next request looks
 * like a broken application rather than a wrong address, and somebody who has just installed
 * something has no reason to assume it is their fault.
 *
 * @param onConnected - Told the address, once something answered at it.
 * @param reach - How to ask whether a Flux is there, which a test replaces.
 */
const ConnectToServer = ({ onConnected, reach = reachServer }: ConnectToServerProps) => {
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const connect = async () => {
    const read = readServerAddress(typed);

    if ('problem' in read) {
      setProblem(read.problem);

      return;
    }

    setProblem(null);
    setAsking(true);

    const answered = await reach(read.address);

    setAsking(false);

    if (!answered) {
      setProblem(
        `Nothing answered at ${read.address}. Check the address and that Flux is running.`,
      );

      return;
    }

    onConnected(read.address);
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <Logo className="h-8 self-start" />

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium text-text">Which Flux is yours?</h1>
          <p className="text-sm text-text-muted">
            The address of your server, the same one you would open in a browser.
          </p>
        </div>

        <TextField
          label="Server address"
          value={typed}
          onValueChange={setTyped}
          placeholder="flux.example.com"
          hasFocusOnMount
          {...(problem === null ? {} : { error: problem })}
        />

        <Button type="submit" disabled={asking}>
          {asking ? <Spinner size="sm" label="Looking for your server" /> : null}
          {asking ? 'Looking for it' : 'Connect'}
        </Button>
      </form>
    </main>
  );
};

ConnectToServer.displayName = 'ConnectToServer';

export { ConnectToServer };
