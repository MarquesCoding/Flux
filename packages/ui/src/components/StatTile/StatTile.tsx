import { cn } from '@ValenceUI/cn';
import type { StatTileProps } from './StatTile.types';

/**
 * One figure about the server, said plainly: the number first, then what it means. Can carry a
 * fraction as a bar and a history as a line, for figures that only mean something against a limit
 * or against themselves an hour ago.
 *
 * Drawn as two layers rather than one box: a tinted shell that carries what the figure is, and a
 * panel set into it that carries the figure. A row of these reads label, figure, label, figure —
 * the eye finds the numbers by their ground, without the labels having to be shouted to tell them
 * apart. Kept small, since a strip of them sits above everything else on the page and is glanced
 * at rather than read.
 *
 * @param label - What the figure is.
 * @param value - The figure itself, formatted for reading.
 * @param detail - A line qualifying it, such as what it is out of.
 * @param icon - Something to draw beside it.
 * @param fraction - How full, where the figure is part of a fixed whole.
 * @param history - A chart of the same figure over time.
 * @param className - Extra classes for the caller's own layout.
 */
const StatTile = ({ label, value, detail, icon, fraction, history, className }: StatTileProps) => (
  <div className={cn('valence-card-shell flex h-full flex-col', className)}>
    <dt className="flex items-center gap-2 px-2.5 pb-1.5 pt-1.5 text-[0.6875rem] uppercase tracking-[0.16em] text-text-muted">
      {icon === undefined ? null : <span className="flex shrink-0 items-center">{icon}</span>}
      {label}
    </dt>

    <dd className="valence-card-face relative flex flex-1 flex-col gap-2 overflow-hidden p-3">
      {history === undefined ? null : (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 opacity-30">
          {history}
        </span>
      )}

      <span className="relative block text-xl font-semibold tabular-nums leading-none tracking-tight text-text">
        {value}
      </span>

      {fraction === undefined ? null : (
        <span
          aria-hidden
          className="relative block h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]"
        >
          <span
            role="presentation"
            className="block h-full rounded-full bg-primary transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-soft)]"
            style={{ width: `${(Math.min(1, Math.max(0, fraction)) * 100).toString()}%` }}
          />
        </span>
      )}

      {detail === undefined ? null : (
        <span className="relative mt-auto block truncate font-body text-xs text-text-muted">
          {detail}
        </span>
      )}
    </dd>
  </div>
);

StatTile.displayName = 'StatTile';

export { StatTile };
