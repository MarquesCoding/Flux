import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react';
import { ArrowUp01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { Icon } from '@ValenceUI/Icon';
import { cn } from '@ValenceUI/cn';
import { useHasScrolledPast } from '@ValenceUI/useHasScrolledPast';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import type { BackToTopProps } from './BackToTop.types';

/**
 * The way back to the top of a page long enough to have lost it, which a page that goes on for as
 * long as there is something to show will always be.
 *
 * Stays out of the way until the top has actually gone. A control offering to return somewhere you
 * can already see is noise, so it is judged against a marker left at the top rather than against a
 * guessed number of pixels — the marker is where the top is, whatever the page turns out to be.
 *
 * Which is why it is mounted first and draws a marker of its own: the button floats free of the
 * page, but the marker has to sit where the page begins. It rises into place and sinks back out
 * rather than blinking on, since something appearing in the corner of the eye is read as a fault
 * where something arriving is read as an offer. Whoever asked for stillness is given the fade alone,
 * and for them the journey back is instant too — a page this long scrolled smoothly is a long way to
 * watch travel past.
 *
 * The button is drawn outside the page rather than within it. Anything held inside something that
 * has been moved is fixed against that thing rather than against the window, and a screen animating
 * in has been moved, however slightly — so a button left there rides up the page as it scrolls
 * instead of staying where it was put. Only the button leaves; the marker stays where the top is.
 *
 * @param label - What it does in words, for anything reading the page aloud.
 * @param className - Extra classes for the caller's own layout.
 */
const BackToTop = ({ label = 'Back to top', className }: BackToTopProps) => {
  const { mark, hasPassed } = useHasScrolledPast();
  const prefersReducedMotion = useReducedMotionConfig();
  const portalContainer = usePortalContainer();

  const button = (
    <AnimatePresence initial={false}>
      {hasPassed ? (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className={cn('fixed bottom-6 right-6 z-40', className)}
        >
          <Button
            variant="glossy"
            size="lg"
            isIconOnly
            label={label}
            hasTooltip={false}
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion === true ? 'auto' : 'smooth',
              });
            }}
          >
            <Icon of={ArrowUp01Icon} size={20} className="size-5" />
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <span ref={mark} aria-hidden className="block h-0" />

      {createPortal(button, portalContainer ?? document.body)}
    </>
  );
};

BackToTop.displayName = 'BackToTop';

export { BackToTop };
