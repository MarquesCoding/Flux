import { z } from 'zod';
import { platformInUse } from '@ValenceClient/platform/installPlatform';

const STORAGE_KEY = 'valence.motion';

const MOTIONS = ['system', 'full', 'reduced'] as const;

const MotionSchema = z.enum(MOTIONS).catch('system');

type Motion = (typeof MOTIONS)[number];

const listeners = new Set<(motion: Motion) => void>();

/**
 * How much movement somebody has asked for, or that they have not asked.
 *
 * Three answers rather than two, for the reason the theme has three: a machine already set to ask
 * for less movement has said what it wants, and an application that made somebody say it again — and
 * then ignored the machine — would be worse than one that never asked. `full` is the answer that
 * only exists because the other two do: somebody on a machine that asks for stillness everywhere may
 * still want Valence to move.
 *
 * @returns What was chosen.
 */
const chosenMotion = (): Motion => MotionSchema.parse(platformInUse().store.read(STORAGE_KEY));

/**
 * Remembers how much movement was asked for and tells whoever is drawing with it.
 *
 * Only remembered here. Putting it on the document is drawing, and this package does not draw — see
 * `applyMotion`, which is the screens' half of the same idea.
 *
 * @param motion - What was chosen.
 */
const chooseMotion = (motion: Motion): void => {
  const { store } = platformInUse();

  if (motion === 'system') {
    store.forget(STORAGE_KEY);
  } else {
    store.write(STORAGE_KEY, motion);
  }

  for (const listener of listeners) {
    listener(motion);
  }
};

/**
 * Watches for the amount of movement being changed.
 *
 * @param listener - Told whenever it changes.
 * @returns A way to stop listening.
 */
const whenMotionChanges = (listener: (motion: Motion) => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Reads whatever a control handed back as an amount of movement.
 *
 * Anything unrecognised is read as following the machine, which is the answer that cannot be wrong.
 *
 * @param said - What was chosen.
 * @returns The amount of movement.
 */
const readMotion = (said: string): Motion => MotionSchema.parse(said);

export type { Motion };

export { STORAGE_KEY, MOTIONS, chooseMotion, chosenMotion, readMotion, whenMotionChanges };
