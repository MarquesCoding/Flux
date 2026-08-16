import { cn } from '@FluxUI/cn';
import type { DialogFooterProps } from './DialogFooter.types';

/**
 * The foot of a dialog, holding the buttons that answer it. Pinned rather than scrolled, so the
 * way out of a dialog is always visible however long its content runs.
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
