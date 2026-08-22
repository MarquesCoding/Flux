import { cn } from '@ValenceUI/cn';
import type { DialogContentProps } from './DialogContent.types';

/**
 * The middle of a dialog, and the only part of it that scrolls — the title and the footer stay
 * where they are, so what a dialog is and how to answer it never scroll out of view.
 *
 * @param children - The dialog's content.
 * @param className - Extra classes for the caller's own layout.
 */
const DialogContent = ({ children, className }: DialogContentProps) => (
  <div className={cn('flux-rail min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}>
    {children}
  </div>
);

DialogContent.displayName = 'DialogContent';

export { DialogContent };
