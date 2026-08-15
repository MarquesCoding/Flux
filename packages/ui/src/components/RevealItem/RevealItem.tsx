import { motion, useReducedMotion } from 'motion/react';
import { revealItemVariants } from '@FluxUI/animations/reveal';
import type { RevealItemProps } from './RevealItem.types';

/**
 * One item of a list, arriving after the ones before it.
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
