import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Logo } from '@ValenceUI/Logo';
import { liquidSpring, stillTransition } from '@ValenceUI/animations/reveal';
import type { SplashScreenProps } from './SplashScreen.types';

const OURS = 'valence';

/**
 * Holds the screen with the platform's own mark while the application works out what it is showing
 * — whether setup is done, who is signed in, and what was being watched. Its own mark rather than a
 * spinner, since this is the first thing anybody sees.
 *
 * The mark stands alone, with no name under it — a mark that needs its own name written beneath is
 * not doing its job. That only holds while the platform is called Valence: an operator who has renamed
 * it gets the name set instead, since the mark is not theirs to stand for.
 *
 * The ground it holds is opaque until the mark has finished travelling, and only then fades. A
 * screen that vanishes the moment the mark sets off shows the page arriving underneath a logo still
 * in flight, which reads as two things happening rather than one handing over to the other.
 *
 * @param name - What the platform is called, which may have been renamed by an operator.
 * @param label - What is being waited for, read out to anybody who cannot see the screen.
 * @param isReady - Whether what was being waited for has arrived, which takes the bar away.
 * @param marksPlace - The name the mark travels under, where it goes on to somewhere else.
 * @param hasMark - Whether this screen is the one holding the mark. False once the mark has been
 *   handed on, so that two of them are never on screen under the same name.
 * @param isLeaving - Whether the ground is fading, which it does once the mark has landed.
 */
const SplashScreen = ({
  name = 'Valence',
  label = 'Loading',
  isReady = false,
  marksPlace,
  hasMark = true,
  isLeaving = false,
}: SplashScreenProps) => {
  const prefersReducedMotion = useReducedMotion();

  const isOurs = name.toLowerCase() === OURS;

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      style={{ opacity: isLeaving ? 0 : 1 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-surface transition-opacity duration-[260ms] ease-out motion-reduce:transition-none${
        isLeaving ? ' pointer-events-none' : ''
      }`}
    >
      {!hasMark ? null : (
        <motion.span
          {...(marksPlace === undefined ? {} : { layoutId: marksPlace })}
          initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            opacity: { duration: 0.22, ease: 'easeOut' },
            y: { duration: 0.22, ease: 'easeOut' },
            layout: prefersReducedMotion === true ? stillTransition : liquidSpring,
          }}
          className="flex items-center justify-center"
        >
          {isOurs ? (
            <Logo size={112} isSolid label={name} />
          ) : (
            <p className="text-4xl font-semibold tracking-[-0.05em] text-text sm:text-5xl">
              {name}
            </p>
          )}
        </motion.span>
      )}

      <AnimatePresence>
        {isReady ? null : (
          <motion.span
            key="bar"
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion === true ? 0 : 0.25, ease: 'easeOut' }}
            className="block h-0.5 w-48 overflow-hidden rounded-full bg-track sm:w-64"
          >
            {prefersReducedMotion === true ? (
              <span className="block h-full w-1/3 rounded-full bg-text/70" />
            ) : (
              <motion.span
                initial={{ x: '-100%' }}
                animate={{ x: '300%' }}
                transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
                className="block h-full w-1/3 rounded-full bg-text/70"
              />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

SplashScreen.displayName = 'SplashScreen';

export { SplashScreen };
