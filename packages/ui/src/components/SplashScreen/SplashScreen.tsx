import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '@ValenceUI/Logo';
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
 * @param name - What the platform is called, which may have been renamed by an operator.
 * @param label - What is being waited for, read out to anybody who cannot see the screen.
 */
const SplashScreen = ({ name = 'Valence', label = 'Loading' }: SplashScreenProps) => {
  const prefersReducedMotion = useReducedMotion();

  const isOurs = name.toLowerCase() === OURS;

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-surface"
    >
      <motion.span
        initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex items-center justify-center"
      >
        {isOurs ? (
          <Logo size={112} isDotted hasEdge isAnimated label={name} />
        ) : (
          <p className="bg-gradient-to-br from-text via-text to-accent bg-clip-text text-4xl font-semibold tracking-[-0.05em] text-transparent sm:text-5xl">
            {name}
          </p>
        )}
      </motion.span>

      <span className="h-0.5 w-48 overflow-hidden rounded-full bg-track sm:w-64">
        {prefersReducedMotion === true ? (
          <span className="block h-full w-1/3 rounded-full bg-text/70" />
        ) : (
          <motion.span
            initial={{ transform: 'translateX(-100%)' }}
            animate={{ transform: 'translateX(300%)' }}
            transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
            className="block h-full w-1/3 rounded-full bg-text/70"
          />
        )}
      </span>
    </div>
  );
};

SplashScreen.displayName = 'SplashScreen';

export { SplashScreen };
