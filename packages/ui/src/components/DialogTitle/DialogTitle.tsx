import { cn } from '@FluxUI/cn';
import type { DialogTitleProps } from './DialogTitle.types';

/**
 * The head of a dialog: what it is, optionally a line explaining it, and anything the caller wants
 * beside them. Pinned rather than scrolled, so what a dialog is about stays on screen while its
 * content moves.
 *
 * @param title - What the dialog is about.
 * @param detail - A line explaining it, where the title alone leaves something unsaid.
 * @param children - Anything to sit beside the title, such as a close button.
 * @param className - Extra classes for the caller's own layout.
 */
const DialogTitle = ({ title, detail, children, className }: DialogTitleProps) => (
  <header
    className={cn(
      'flex shrink-0 items-start justify-between gap-4 px-6 py-4',
      'border-b border-[var(--surface-line)]',
      className,
    )}
  >
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="truncate text-lg py-1 text-white font-semibold">{title}</h2>

      {detail === undefined ? null : <p className="font-body text-sm text-text-muted">{detail}</p>}
    </div>

    {children === undefined ? null : (
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    )}
  </header>
);

DialogTitle.displayName = 'DialogTitle';

export { DialogTitle };
