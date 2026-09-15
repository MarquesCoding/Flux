import { cn } from '@ValenceUI/cn';
import type { DialogFooterProps } from './DialogFooter.types';

/**
 * The foot of a dialog, holding the buttons that answer it. Pinned rather than scrolled, so the way
 * out of a dialog is always visible however long its content runs.
 *
 * The buttons share the bar as equal columns. A question with two answers should not suggest which
 * one to give by making it wider, and a bar of actions with three buttons huddled at one end reads
 * as an afterthought rather than as the thing the dialog is for.
 *
 * Equal columns is what a bar of actions wants when there is room for one. On a phone there is not:
 * three answers across 358px is 111px each, and a button will not shrink to fit — it is
 * `whitespace-nowrap` and `shrink-0` by design, so the labels run out of their cells rather than
 * wrapping inside them. Below the small breakpoint the answers stack instead, one to a line, which
 * is the one arrangement that cannot overflow however long a label is.
 *
 * A footer holding more actions than a phone can stack without filling the screen wants `ActionBar`
 * inside it rather than this: folding the lesser actions into a menu keeps the main one readable,
 * where stacking only moves the problem down the page.
 *
 * @param children - The buttons answering the dialog.
 * @param className - Extra classes for the caller's own layout.
 */
const DialogFooter = ({ children, className }: DialogFooterProps) => (
  <footer
    className={cn(
      'grid shrink-0 gap-3',
      'sm:grid-flow-col sm:[grid-auto-columns:1fr]',
      'border-t border-[var(--surface-line)] p-4',
      '[&>*]:w-full',
      className,
    )}
  >
    {children}
  </footer>
);

DialogFooter.displayName = 'DialogFooter';

export { DialogFooter };
