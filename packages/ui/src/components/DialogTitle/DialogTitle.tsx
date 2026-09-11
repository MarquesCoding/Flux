import { cn } from '@ValenceUI/cn';
import type { DialogTitleProps } from './DialogTitle.types';

/**
 * The head of a dialog: what it is, optionally a face or a mark before it, a line explaining it,
 * anything the caller wants beside them, and a row beneath. Pinned rather than scrolled, so what a
 * dialog is about stays on screen while its content moves.
 *
 * No rule beneath it. A dialog is already a panel with an edge of its own, and a second line drawn
 * a few rows in cuts it into two boxes; the space and the weight of the title are what separate the
 * head from what follows.
 *
 * The row beneath is where a dialog's own navigation goes. Putting it here rather than at the top of
 * the content keeps it still while the content scrolls under it, and stops the head and the first
 * thing inside saying the same thing twice.
 *
 * @param title - What the dialog is about.
 * @param detail - A line explaining it, where the title alone leaves something unsaid.
 * @param icon - Something to draw before the title, such as whose account this is.
 * @param below - A row beneath the head, such as the dialog's own tabs.
 * @param children - Anything to sit beside the title, such as a close button.
 * @param size - How much room the head takes. Compact sets the title and its line side by side at
 *   body size, for a dialog that is a workspace — somewhere the panels are the point and a head
 *   the height of a banner is room taken from them on every panel.
 * @param className - Extra classes for the caller's own layout.
 */
const DialogTitle = ({
  title,
  detail,
  icon,
  below,
  children,
  size = 'default',
  className,
}: DialogTitleProps) => {
  const isCompact = size === 'compact';

  return (
    <header
      className={cn(
        'flex shrink-0 flex-col',
        isCompact ? 'gap-1 px-5 pt-3' : 'gap-4 px-6 pb-4 pt-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className={cn('flex min-w-0 items-center', isCompact ? 'gap-2.5' : 'gap-4')}>
          {icon === undefined ? null : <span className="flex shrink-0 items-center">{icon}</span>}

          <div
            className={cn('flex min-w-0', isCompact ? 'items-baseline gap-2.5' : 'flex-col gap-1')}
          >
            <h2
              className={cn(
                'truncate font-semibold text-text',
                isCompact ? 'shrink-0 text-base' : 'text-2xl tracking-[-0.02em]',
              )}
            >
              {title}
            </h2>

            {detail === undefined ? null : (
              <p
                className={cn(
                  'truncate font-body text-text-muted',
                  isCompact ? 'text-xs' : 'text-sm',
                )}
              >
                {detail}
              </p>
            )}
          </div>
        </div>

        {children === undefined ? null : (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        )}
      </div>

      {below === undefined ? null : below}
    </header>
  );
};

DialogTitle.displayName = 'DialogTitle';

export { DialogTitle };
