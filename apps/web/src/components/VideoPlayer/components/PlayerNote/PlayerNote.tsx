import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PlayerNoteProps } from './PlayerNote.types';

/**
 * The one line the player says over the picture — who paused, that the room is waiting, that a cast
 * device took over.
 *
 * The player keeps its own rather than using the application's toasts, and that is deliberate: a
 * toast is portalled to the document, and the document is not what the viewer is looking at while a
 * video is fullscreen. A message the viewer cannot see is worse than no message, so this one lives
 * inside the element that goes fullscreen with it.
 *
 * It enters and leaves by the same short path, which is what keeps it reading as one line arriving
 * rather than as something appearing and something else vanishing.
 *
 * @param note - What to say, or nothing to say nothing.
 * @returns The line, over the picture.
 */
const PlayerNote = ({ note }: PlayerNoteProps) => {
  const prefersReducedMotion = useReducedMotion();
  const isStill = prefersReducedMotion === true;

  return (
    <AnimatePresence>
      {note === null ? null : (
        <motion.div
          initial={{ opacity: 0, y: isStill ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isStill ? 0 : 8 }}
          transition={{ duration: isStill ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-x-0 top-6 z-30 flex justify-center px-4"
        >
          <p
            role="status"
            className="flux-glass max-w-md rounded-md px-4 py-2 text-center text-sm text-white"
          >
            {note}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

PlayerNote.displayName = 'PlayerNote';

export { PlayerNote };
