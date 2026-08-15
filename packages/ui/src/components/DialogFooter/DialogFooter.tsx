import { cn } from '@FluxUI/cn';
import type { DialogFooterProps } from './DialogFooter.types';

/**
 * What a dialog is answered with, always in view.
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
