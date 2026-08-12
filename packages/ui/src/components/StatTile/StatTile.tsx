import { Card } from '@FluxUI/Card';
import { cn } from '@FluxUI/cn';
import type { StatTileProps } from './StatTile.types';

/**
 * One figure about the server, said plainly.
 *
 * The figure is the largest thing in it and everything else is smaller,
 * because a strip of these is read by glancing along the numbers. A bar
 * appears only for a figure that is a proportion of something — a count of
 * streams has no full, and drawing it half empty invents a limit.
 *
 * A term and its description, so it belongs inside a `<dl>`: a row of figures
 * is a list of names and values, and saying so is what lets a screen reader
 * read "memory, twenty-seven gigabytes" rather than two loose numbers.
 *
 * The name sits at the top and everything else at the foot, so a row of these
 * lines up along its figures however much each has to say underneath.
 */
const StatTile = ({ label, value, detail, icon, fraction, history, className }: StatTileProps) => (
  <Card padding="none" className={cn('h-full overflow-hidden', className)}>
    {history === undefined ? null : (
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 opacity-30">
        {history}
      </span>
    )}

    <div className="relative flex h-full flex-col gap-3 p-4">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted">
        {icon === undefined ? null : <span className="flex shrink-0 items-center">{icon}</span>}
        {label}
      </dt>

      <dd className="mt-auto flex flex-col gap-2">
        <span className="block text-2xl font-semibold tabular-nums leading-none tracking-tight text-text sm:text-3xl">
          {value}
        </span>

        {fraction === undefined ? null : (
          <span
            aria-hidden
            className="block h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]"
          >
            <span
              role="presentation"
              className="block h-full rounded-full bg-accent transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-soft)]"
              style={{ width: `${(Math.min(1, Math.max(0, fraction)) * 100).toString()}%` }}
            />
          </span>
        )}

        {detail === undefined ? null : (
          <span className="block font-body text-xs text-text-muted">{detail}</span>
        )}
      </dd>
    </div>
  </Card>
);

StatTile.displayName = 'StatTile';

export { StatTile };
