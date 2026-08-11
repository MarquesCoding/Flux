import { motion, useReducedMotion } from 'motion/react';
import type { SplashScreenProps } from './SplashScreen.types';

/**
 * The screen shown while the application works out what it is showing.
 *
 * A cold load has to ask the server whether setup is needed and who is signed
 * in before it can draw anything true, and a blank page during that reads as a
 * broken one. A name and a moving bar say the same thing a spinner would, but
 * say it as an opening title rather than as an apology.
 *
 * The bar is indeterminate on purpose. Nothing here knows how long it will
 * take, and a progress bar that guesses is a progress bar that lies.
 */
const SplashScreen = ({ name = 'Flux', label = 'Loading' }: SplashScreenProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-surface"
    >
      <motion.p
        initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-gradient-to-br from-text via-text to-accent bg-clip-text text-5xl font-semibold tracking-[-0.05em] text-transparent sm:text-7xl"
      >
        {name}
      </motion.p>

      <span className="h-0.5 w-48 overflow-hidden rounded-full bg-white/10 sm:w-64">
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
      </span>
    </div>
  );
};

SplashScreen.displayName = 'SplashScreen';

export { SplashScreen };
