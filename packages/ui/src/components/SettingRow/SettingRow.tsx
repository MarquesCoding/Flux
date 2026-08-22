import { cn } from '@ValenceUI/cn';
import type { SettingRowProps } from './SettingRow.types';

/**
 * One setting, said in two lines and answered on the right: what it is, what it does to you if you
 * change it, and the control that changes it. The pattern the whole of Valence's settings are made
 * of, kept in one place so that a switch, a menu and a button all sit on the same baseline and
 * leave the same room around them rather than each screen arranging its own.
 *
 * The row is not itself pressable. What answers the setting is the control on the right, which
 * keeps one press target per row instead of two that disagree about what they do.
 *
 * @param title - What the setting is.
 * @param description - What changing it does, in one line.
 * @param icon - Something to draw before the title.
 * @param children - The control that answers it.
 * @param isMarked - Whether this is the row being pointed at, which outlines it.
 * @param className - Extra classes for the caller's own layout.
 */
const SettingRow = ({
  title,
  description,
  icon,
  children,
  isMarked = false,
  className,
}: SettingRowProps) => (
  <div
    data-slot="setting-row"
    {...(isMarked ? { 'data-marked': 'true' } : {})}
    className={cn(
      'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4',
      'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
      'motion-reduce:transition-none',
      isMarked
        ? 'relative z-10 rounded-lg bg-highlight/[0.07] ring-2 ring-highlight ring-inset'
        : '',
      className,
    )}
  >
    <div className="flex min-w-0 flex-1 items-start gap-3">
      {icon === undefined ? null : (
        <span className="flex shrink-0 items-center pt-0.5 text-text-muted">{icon}</span>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[0.9375rem] font-semibold leading-tight text-text">{title}</span>

        {description === undefined ? null : (
          <span className="font-body text-[0.8125rem] leading-snug text-text-muted">
            {description}
          </span>
        )}
      </div>
    </div>

    {children === undefined ? null : (
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    )}
  </div>
);

SettingRow.displayName = 'SettingRow';

export { SettingRow };
