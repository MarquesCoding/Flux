import { useState } from 'react';
import { motion, useReducedMotionConfig } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { TextField } from '@ValenceUI/TextField';
import { Logo } from '@ValenceUI/Logo';
import { MoodBackground } from '@ValenceUI/MoodBackground';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { readServerAddress } from '@ValenceClient/session/readServerAddress';
import { reachServer } from './reachServer';
import type { ConnectToServerProps } from './ConnectToServer.types';

/**
 * Asks which Valence this client is for, which a client that serves its own pages has no way of
 * knowing and a browser never has to ask.
 *
 * Dressed as the way in, because it is the way in. This and the profile gate are the two screens
 * somebody meets before there is anything of theirs to look at, and they are one moment rather than
 * two: the same backdrop, the same mark above the same size of heading, the same pill of a field and
 * the same button under it. Drawn as an ordinary form on a flat page, the first screen of the
 * application looked like a setup step for something else.
 *
 * The address is tried before it is kept. A typo that is only discovered at the next request looks
 * like a broken application rather than a wrong address, and somebody who has just installed
 * something has no reason to assume it is their fault.
 *
 * Somebody arriving here because the server they already named stopped answering is shown that
 * address and told so, rather than an empty box — they came here to correct a detail or to wait, not
 * to remember what they typed months ago.
 *
 * A server running on this machine is found rather than asked for, and offered as something to
 * press. Finding one is not the same as it being theirs — somebody may run two, or be setting one up
 * while watching another — so it is offered rather than assumed, and the box is still there for
 * anybody whose Valence is somewhere else.
 *
 * @param onConnected - Told the address, once something answered at it.
 * @param startWith - What to put in the box, for somebody being asked again.
 * @param couldNotReach - The address that stopped answering, where that is why they are here.
 * @param reach - How to ask whether a Valence is there, which a test replaces.
 * @param found - Servers already found on this machine, which have answered before being offered.
 */
const ConnectToServer = ({
  onConnected,
  startWith = '',
  couldNotReach,
  reach = reachServer,
  found = [],
}: ConnectToServerProps) => {
  const [typed, setTyped] = useState(startWith);
  const [problem, setProblem] = useState<string | null>(
    couldNotReach === undefined
      ? null
      : `Valence at ${couldNotReach} could not be reached. Check that it is running.`,
  );
  const [asking, setAsking] = useState(false);
  const prefersReducedMotion = useReducedMotionConfig();

  const arrives = revealTransition(prefersReducedMotion);

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
        `Nothing answered at ${read.address}. Check the address and that Valence is running.`,
      );

      return;
    }

    onConnected(read.address);
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-6 py-16">
      <MoodBackground hasGrid isDrifting />

      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="shown"
        className="flex w-full max-w-xl flex-col items-center gap-8"
      >
        <motion.span variants={revealVariants(prefersReducedMotion)} transition={arrives}>
          <Logo size={44} hasEdge isAnimated label="Valence" />
        </motion.span>

        <motion.div
          variants={revealVariants(prefersReducedMotion)}
          transition={revealTransition(prefersReducedMotion, 'heavy')}
          className="flex flex-col items-center gap-2 text-center"
        >
          <h1 className="text-balance text-[clamp(1.75rem,5vw,3rem)] font-semibold leading-tight tracking-[-0.04em] text-text">
            Which Valence is yours?
          </h1>

          <p className="text-sm text-text-muted">The address you would open in a browser.</p>
        </motion.div>

        {found.length === 0 ? null : (
          <motion.div
            variants={revealVariants(prefersReducedMotion)}
            transition={arrives}
            className="flex w-full max-w-sm flex-col items-center gap-3"
          >
            <p className="text-sm text-text-muted">Found on this machine</p>

            {found.map((address) => (
              <Button
                key={address}
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  onConnected(address);
                }}
              >
                {address.replace(/^https?:\/\//, '')}
              </Button>
            ))}
          </motion.div>
        )}

        <motion.form
          noValidate
          variants={revealVariants(prefersReducedMotion)}
          transition={arrives}
          className="flex w-full max-w-sm flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <TextField
            label="Server address"
            value={typed}
            onValueChange={setTyped}
            placeholder="valence.example.com"
            size="lg"
            hasFocusOnMount
            {...(problem === null ? {} : { error: problem })}
          />

          <Button type="submit" variant="glossy" size="lg" isLoading={asking}>
            {asking ? 'Looking for it' : 'Connect'}
          </Button>
        </motion.form>
      </motion.div>

      <p className="absolute bottom-8 text-xs tracking-[0.2em] text-text-muted/60">© Valence</p>
    </main>
  );
};

ConnectToServer.displayName = 'ConnectToServer';

export { ConnectToServer };
