import { motion, useReducedMotion } from 'motion/react';
import { revealItemVariants } from '@ValenceUI/animations/reveal';
import type { RevealItemProps } from './RevealItem.types';

/**
 * Wraps one item of a row so it arrives after the ones before it, giving a row that assembles left
 * to right rather than appearing at once. The index rather than the position on screen decides the
 * wait, so a row that is scrolled still arrives in order.
 *
 * @param children - The item.
 * @param index - Where it sits in the row, counting from zero.
 * @param className - Extra classes for the caller's own layout.
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
