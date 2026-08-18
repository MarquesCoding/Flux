import { Icon } from '@FluxUI/Icon';
import { Logo } from '@FluxUI/Logo';
import { ArrowLeft01Icon, ArrowRight01Icon, Key01Icon } from '@hugeicons/core-free-icons';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import { TextField } from '@FluxUI/TextField';
import { MoodBackground } from '@FluxUI/MoodBackground';
import { PageDots } from '@FluxUI/PageDots';
import { Spinner } from '@FluxUI/Spinner';
import {
  revealVariants,
  revealTransition,
  staggerVariants,
  liquidSpring,
  stillTransition,
} from '@FluxUI/animations/reveal';
import { signInAsProfile } from '@FluxClient/profiles/fetchEveryone';
import { useQuery } from '@tanstack/react-query';
import { sessionQueries } from '@FluxClient/query/sessionQueries';
import { ProfileFace } from '@FluxWeb/components/ProfileFace/ProfileFace';
import { TwoFactorChallenge } from '@FluxWeb/components/TwoFactorChallenge/TwoFactorChallenge';
import { isPasskeySupported } from '@FluxWeb/passkeys/isPasskeySupported';
import { authenticateWithPasskey } from '@FluxClient/session/auth';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';
import type { ProfileGateProps } from './ProfileGate.types';

const PER_PAGE = 10;

const TITLE_MILLISECONDS = 1100;

const ARROWS: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: 5,
  ArrowUp: -5,
};

const FACES: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const FACE: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0 },
};

/**
 * Draws the face somebody picked, at either the size the picker uses or the larger size the gate
 * shows once one is chosen.
 *
 * @param profile - Whose face to draw.
 * @param isLarge - Whether to draw it at the larger of the two sizes.
 */
const Portrait = ({ profile, isLarge = false }: { profile: ViewerProfile; isLarge?: boolean }) => (
  <ProfileFace
    profile={profile}
    className={`rounded-lg shadow-xl ${
      isLarge ? 'size-32 text-5xl sm:size-36' : 'aspect-square w-full text-4xl sm:text-5xl'
    }`}
  />
);

Portrait.displayName = 'Portrait';

/**
 * The way in to Flux: who is watching, and then the password if the household asks for one. Kept
 * apart from the sign-in form proper because choosing a profile is a household gesture rather than
 * an authentication one, and most of the time it is the only step anybody takes.
 *
 * @param onSignedIn - Called once somebody is through.
 * @param name - What this server calls itself, shown above the faces.
 */
const ProfileGate = ({ onSignedIn, name = 'Flux' }: ProfileGateProps) => {
  const asking = useQuery(sessionQueries.everyone());
  const everyone = asking.data ?? null;
  const [chosen, setChosen] = useState<ViewerProfile | null>(null);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsingPasskey, setIsUsingPasskey] = useState(false);
  const build = useQuery(sessionQueries.version());
  const version = build.data ?? null;
  const [hasLeftWall, setHasLeftWall] = useState(false);
  const [page, setPage] = useState(0);
  const [at, setAt] = useState(0);
  const [isTitleOver, setIsTitleOver] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);

  const isFlux = name.toLowerCase() === 'flux';
  const facesRef = useRef(new Map<string, HTMLButtonElement>());
  const prefersReducedMotion = useReducedMotion();

  const move = prefersReducedMotion === true ? stillTransition : liquidSpring;
  const faceArrival = revealTransition(prefersReducedMotion);

  const pages = Math.max(1, Math.ceil((everyone?.length ?? 0) / PER_PAGE));
  const shown = (everyone ?? []).slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTitleOver(true);
    }, TITLE_MILLISECONDS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (everyone === null || chosen !== null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const step = ARROWS[event.key];

      if (step === undefined || everyone.length === 0) {
        return;
      }

      event.preventDefault();

      setIsReturning(false);

      setAt((current) => {
        const next = Math.min(Math.max(current + step, 0), everyone.length - 1);

        setPage(Math.floor(next / PER_PAGE));

        return next;
      });
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [everyone, chosen]);

  useEffect(() => {
    if (chosen === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReturning(true);
        setChosen(null);
        setPassword('');
        setProblem(null);
        setNeedsCode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [chosen]);

  useEffect(() => {
    if (chosen !== null) {
      return;
    }

    facesRef.current.get(everyone?.[at]?.id ?? '')?.focus();
  }, [at, page, chosen, everyone]);

  const submit = async () => {
    if (chosen === null) {
      return;
    }

    setIsSubmitting(true);
    setProblem(null);

    const outcome = await signInAsProfile(chosen.id, password);

    setIsSubmitting(false);

    if (outcome.kind === 'signedIn') {
      onSignedIn();

      return;
    }

    if (outcome.kind === 'needsCode') {
      setNeedsCode(true);
      setPassword('');

      return;
    }

    setProblem(outcome.reason);
    setPassword('');
  };

  const signInWithPasskey = async () => {
    setIsUsingPasskey(true);
    setProblem(null);

    try {
      const outcome = await authenticateWithPasskey();

      if (outcome.kind === 'failed') {
        setProblem(outcome.reason);

        return;
      }

      if (outcome.kind !== 'cancelled') {
        onSignedIn();
      }
    } finally {
      setIsUsingPasskey(false);
    }
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-6 py-16">
      <MoodBackground
        lights={chosen === null ? [] : [{ color: chosen.colour }]}
        hasGrid
        isDrifting
      />

      <motion.p
        layoutId="flux-mark"
        initial={{ opacity: 0, scale: prefersReducedMotion === true ? 1 : 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          opacity: { duration: 0.7, ease: 'easeOut' },
          scale: { duration: 0.7, ease: 'easeOut' },
          layout: move,
        }}
        className={cn('flex items-center gap-1', isTitleOver ? '' : 'absolute')}
      >
        {isFlux ? (
          <Logo
            size={isTitleOver ? 44 : 128}
            isDotted={!isTitleOver}
            hasEdge
            isAnimated
            label={name}
          />
        ) : (
          <span
            className={cn(
              'bg-gradient-to-br from-text via-text to-accent bg-clip-text font-semibold',
              'tracking-[-0.05em] text-transparent',
              isTitleOver ? 'text-[clamp(1.75rem,4vw,2.5rem)]' : 'text-[clamp(3rem,12vw,7rem)]',
            )}
          >
            {name}
          </span>
        )}
      </motion.p>

      {!isTitleOver ? null : everyone === null ? (
        <Spinner label="Reading who is here" size="lg" />
      ) : (
        <div className="flex w-full flex-col items-center">
          {chosen === null ? (
            <motion.div
              key="wall"
              variants={staggerVariants}
              initial={hasLeftWall ? false : 'hidden'}
              animate="shown"
              className="flex w-full flex-col items-center gap-12"
            >
              <motion.h1
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion, 'heavy')}
                className="text-[clamp(1.75rem,5vw,3rem)] font-semibold tracking-[-0.04em] text-text"
              >
                Who is watching?
              </motion.h1>

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="flex w-full items-center justify-center gap-2 sm:gap-6"
              >
                <span className={pages > 1 ? '' : 'invisible'}>
                  <Button
                    isIconOnly
                    variant="ghost"
                    label="Previous"
                    disabled={page === 0}
                    onClick={() => {
                      setIsReturning(false);
                      setPage((current) => Math.max(current - 1, 0));
                    }}
                  >
                    <Icon of={ArrowLeft01Icon} size={20} />
                  </Button>
                </span>

                <motion.ul
                  key={page}
                  variants={FACES}
                  initial={isReturning ? false : 'hidden'}
                  animate="shown"
                  className="flex min-h-[13rem] w-full max-w-4xl flex-wrap items-start justify-center gap-6 sm:min-h-[15rem] sm:gap-10"
                >
                  {shown.map((profile) => (
                    <motion.li key={profile.id} variants={FACE} transition={faceArrival}>
                      <motion.button
                        type="button"
                        ref={(element) => {
                          if (element === null) {
                            facesRef.current.delete(profile.id);
                          } else {
                            facesRef.current.set(profile.id, element);
                          }
                        }}
                        layoutId={`profile-${profile.id}`}
                        transition={move}
                        onFocus={() => {
                          setAt(everyone.findIndex((one) => one.id === profile.id));
                        }}
                        onClick={() => {
                          setHasLeftWall(true);
                          setChosen(profile);
                          setProblem(null);
                        }}
                        {...(prefersReducedMotion === true
                          ? {}
                          : {
                              whileHover: { y: -8 },
                              whileTap: { scale: 0.97 },
                            })}
                        className="flex w-24 flex-col items-center gap-3 sm:w-32"
                      >
                        <Portrait profile={profile} />

                        <span className="w-full truncate text-center text-sm text-text-muted">
                          {profile.name}
                        </span>
                      </motion.button>
                    </motion.li>
                  ))}
                </motion.ul>

                <span className={pages > 1 ? '' : 'invisible'}>
                  <Button
                    isIconOnly
                    variant="ghost"
                    label="Next"
                    disabled={page >= pages - 1}
                    onClick={() => {
                      setIsReturning(false);
                      setPage((current) => Math.min(current + 1, pages - 1));
                    }}
                  >
                    <Icon of={ArrowRight01Icon} size={20} />
                  </Button>
                </span>
              </motion.div>

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
              >
                <PageDots
                  count={pages}
                  selectedIndex={page}
                  label="Pages of people"
                  onSelect={(at) => {
                    setIsReturning(false);
                    setPage(at);
                  }}
                />
              </motion.div>

              {everyone.length !== 0 ? null : (
                <motion.p
                  variants={revealVariants(prefersReducedMotion)}
                  transition={revealTransition(prefersReducedMotion)}
                  className="max-w-sm text-center text-sm text-text-muted"
                >
                  Nobody has an account on this server yet.
                </motion.p>
              )}
            </motion.div>
          ) : (
            <div key="password" className="flex w-full max-w-sm flex-col items-center gap-6">
              <motion.span layoutId={`profile-${chosen.id}`} transition={move}>
                <Portrait profile={chosen} isLarge />
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-2xl font-semibold tracking-tight text-text"
              >
                {chosen.name}
              </motion.h1>

              {needsCode ? (
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  className="flex w-full flex-col gap-4"
                >
                  <TwoFactorChallenge onVerified={onSignedIn} />
                </motion.div>
              ) : (
                <motion.form
                  noValidate
                  initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14, duration: 0.35, ease: [0.2, 0, 0, 1] }}
                  className="flex w-full flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <TextField
                    label="Password"
                    type="password"
                    size="lg"
                    isPill
                    value={password}
                    onValueChange={setPassword}
                    autoComplete="current-password"
                    {...(problem === null ? {} : { error: problem })}
                  />

                  <Button
                    type="submit"
                    variant="glossy"
                    size="lg"
                    isPill
                    isLoading={isSubmitting}
                    disabled={password === ''}
                  >
                    Watch
                    <Icon of={ArrowRight01Icon} size={18} />
                  </Button>

                  {!isPasskeySupported() ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      isPill
                      isLoading={isUsingPasskey}
                      onClick={() => {
                        void signInWithPasskey();
                      }}
                    >
                      <Icon of={Key01Icon} size={16} />
                      Use a passkey instead
                    </Button>
                  )}
                </motion.form>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  isIconOnly
                  variant="ghost"
                  label="Somebody else"
                  onClick={() => {
                    setIsReturning(true);
                    setChosen(null);
                    setPassword('');
                    setProblem(null);
                    setNeedsCode(false);
                  }}
                >
                  <Icon of={ArrowLeft01Icon} size={18} />
                </Button>
              </motion.div>
            </div>
          )}
        </div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: isTitleOver ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="absolute bottom-8 text-xs tracking-[0.2em] text-text-muted/60"
      >
        © {name} · {version ?? '…'}
      </motion.p>
    </main>
  );
};

ProfileGate.displayName = 'ProfileGate';

export { ProfileGate };
