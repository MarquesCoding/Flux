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
 * A footer holding more than a phone can fit in one row wants `ActionBar` inside it rather than a
 * wrapping footer: folding the lesser actions into a menu keeps the main one readable, where
 * wrapping only moves the problem onto a second line.
 *
 * @param children - The buttons answering the dialog.
 * @param className - Extra classes for the caller's own layout.
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
