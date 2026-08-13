import { motion, useReducedMotion } from 'motion/react';
import { revealItemVariants } from '@FluxUI/animations/reveal';
import type { RevealItemProps } from './RevealItem.types';

/**
 * One item of a list, arriving after the ones before it.
 *
 * A page of cards that appears all at once reads as a screenshot: everything
 * is simply there, and the eye has nowhere to start. Arriving in order gives
 * it somewhere — the first card is the first thing seen, and the rest follow
 * the way they are meant to be read.
 *
 * The delay is short and it has a ceiling, so this is a lead rather than a
 * wait. Under a reduced-motion preference the cards fade in place instead of
 * lifting, which keeps the order without the movement.
 *
 * Belongs inside something animating between `hidden` and `shown` — a row or
 * a grid — which is where it is told to arrive.
 */
const RevealItem = ({ children, index, className }: RevealItemProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.li
      custom={index}
      variants={revealItemVariants(prefersReducedMotion)}
      className={className}
    >
      {children}
    </motion.li>
  );
};

RevealItem.displayName = 'RevealItem';

export { RevealItem };
