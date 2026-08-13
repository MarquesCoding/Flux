import { formatBytes } from '@FluxWeb/components/AdminArea/formatBytes';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import { cacheRows } from './cacheRows';
import type { CacheBreakdownProps } from './CacheBreakdown.types';

/**
 * What Flux itself is keeping on the disk.
 *
 * The strip at the top answers "will I run out of room". This answers the
 * other storage question, which is "what is Flux hoarding" — a composition
 * rather than a single reading, so it is a set of figures rather than one
 * percentage.
 *
 * Laid out across the row like the strip above it rather than as a list of
 * rows, because four figures side by side are read by glancing along them, and
 * a full-width list would leave each name stranded from its number.
 *
 * None of these are measured when this is drawn. Adding up an artefact cache
 * means walking thousands of directories, so both services count on their own
 * timers and this shows what they last found — which is why it says when.
 */
const CacheBreakdown = ({ cache, artwork, liveSessions }: CacheBreakdownProps) => {
  const rows = cacheRows(cache, artwork, liveSessions);
  const total =
    (cache === null ? 0 : cache.previews.bytes + cache.trickplay.bytes) +
    (cache?.sessions.bytes ?? 0) +
    (artwork?.bytes ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-[0.16em] text-text-muted">{row.label}</dt>
            <dd className="flex flex-col gap-0.5">
              <span className="text-xl font-semibold tabular-nums leading-none text-text">
                {row.value}
              </span>
              <span className="text-xs text-text-muted">{row.detail}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-text-muted">
        {cache === null && artwork === null
          ? 'Counting what is on the disk.'
          : `${formatBytes(total)} in total · counted ${describeSince(
              new Date(cache?.atMs ?? artwork?.atMs ?? 0).toISOString(),
              Date.now(),
            )}`}
      </p>
    </div>
  );
};

CacheBreakdown.displayName = 'CacheBreakdown';

export { CacheBreakdown };
