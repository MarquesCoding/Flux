import { cn } from '@FluxUI/cn';
import type { DialogTitleProps } from './DialogTitle.types';

/**
 * The head of a dialog, which does not scroll.
 *
 * Pinned above the content so that whatever is being read, the thing being
 * answered stays on screen. A dialog whose title scrolls away is a question
 * you have to scroll back up to remember.
 *
 * Set in the same small capitals as a card's header, because a dialog is a
 * card that arrived over the page and there is no reason for the two to name
 * themselves differently. The line under it is quieter still: it explains, and
 * an explanation competing with its own heading is neither.
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
