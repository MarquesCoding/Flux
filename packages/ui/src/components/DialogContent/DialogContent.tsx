import { cn } from '@FluxUI/cn';
import type { DialogContentProps } from './DialogContent.types';

/**
 * The part of a dialog that scrolls.
 */
const DialogContent = ({ children, className }: DialogContentProps) => (
  <div className={cn('flux-rail min-h-0 flex-1 overflow-y-auto px-6 py-5', className)}>
    {children}
  </div>
);

DialogContent.displayName = 'DialogContent';

export { DialogContent };
