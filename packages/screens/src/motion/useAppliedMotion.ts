import { useLayoutEffect } from 'react';
import { useMotion } from '@ValenceClient/shell/useMotion';
import { applyMotion } from '@ValenceScreens/motion/applyMotion';
import type { HowMuchMovement } from '@ValenceScreens/motion/motion.types';

/**
 * Keeps the document marked with how much movement is in force, and says what to tell `motion`.
 *
 * Two halves because movement comes from two places that cannot see each other. The stylesheet reads
 * the document attribute; `motion/react` reads its own context and nothing else. Marking the
 * document alone would leave every spring and every layout animation running at full tilt, which is
 * most of the movement there is.
 *
 * Before the browser paints rather than after, so that nothing animates once on the way to being
 * told not to.
 *
 * @returns What to give `MotionConfig`, which is `user` where nobody has overruled the machine.
 */
const useAppliedMotion = (): HowMuchMovement => {
  const { motion } = useMotion();

  useLayoutEffect(() => {
    applyMotion(motion);
  }, [motion]);

  if (motion === 'reduced') {
    return 'always';
  }

  if (motion === 'full') {
    return 'never';
  }

  return 'user';
};

export { useAppliedMotion };
