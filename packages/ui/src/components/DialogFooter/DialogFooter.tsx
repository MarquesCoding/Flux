import { cn } from '@FluxUI/cn';
import type { DialogFooterProps } from './DialogFooter.types';

/**
 * What a dialog is answered with, always in view.
 *
 * Outside the scroll and ruled off from it, so the way out of a dialog is in
 * the same place whether its content is two lines or two hundred.
 *
 * Its actions share the width equally rather than huddling at one end: on a
 * bounded box the two answers are the whole point of the foot, and a pair of
 * small buttons in a corner makes somebody hunt for the one they want. The
 * affirmative one is last, which is where a pointer travelling down the
 * content arrives.
 *
 * A shade deeper than the content rather than lighter, so the parts that stay
 * put read as the frame around what moves.
 *
 * Padded evenly on all four sides. Buttons that fill the width leave no room
 * either side of themselves, so the gap above and below has to match the gap
 * beside them or the row sits in a letterbox.
 */
const DialogFooter = ({ children, className }: DialogFooterProps) => (
  <footer
    className={cn(
      'grid shrink-0 grid-flow-col gap-3 [grid-auto-columns:1fr]',
      'border-t border-[var(--surface-line)] bg-surface p-4',
      '[&>*]:w-full',
      className,
    )}
  >
    {children}
  </footer>
);

DialogFooter.displayName = 'DialogFooter';

export { DialogFooter };
