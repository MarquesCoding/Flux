import { useCallback, useEffect, useState } from 'react';
import { chooseMotion, chosenMotion, whenMotionChanges } from '@ValenceClient/shell/motion';
import type { Motion } from '@ValenceClient/shell/motion';

type MotionChoice = {
  motion: Motion;
  choose: (motion: Motion) => void;
};

/**
 * How much movement is in force, and how to change it.
 *
 * @returns The chosen amount of movement and the way to choose another.
 */
const useMotion = (): MotionChoice => {
  const [motion, setMotion] = useState(chosenMotion);

  useEffect(() => whenMotionChanges(setMotion), []);

  const choose = useCallback((chosen: Motion) => {
    chooseMotion(chosen);
  }, []);

  return { motion, choose };
};

export type { MotionChoice };

export { useMotion };
