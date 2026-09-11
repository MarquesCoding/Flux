import { Icon } from '@ValenceUI/Icon';
import { InformationCircleIcon } from '@hugeicons/core-free-icons';
import { Button } from '@ValenceUI/Button';
import { HoverCard } from '@ValenceUI/HoverCard';
import { formatBytes } from '@ValenceCore/functions/formatBytes';
import { describeSince } from '@ValenceScreens/components/AdminArea/describeSince';
import { cacheRows } from './cacheRows';
import type { CacheBreakdownProps } from './CacheBreakdown.types';

/**
 * What Valence itself is keeping on the disk, a kind at a time: preview clips, scrub thumbnails,
 * artwork, and what is being written for sessions running now. The library's own files are shown
 * beside them for scale, since the useful question is usually how much Valence has added to what was
 * already there.
 *
 * @param cache - What the monitor found on disk, or null while it is still counting.
 * @param artwork - How much artwork has been fetched and kept.
 * @param liveSessions - How many sessions are writing at the moment.
 * @param library - How much the library itself holds, where that has been worked out.
 */
const CacheBreakdown = ({ cache, artwork, liveSessions, library }: CacheBreakdownProps) => {
  const rows = cacheRows(cache, artwork, liveSessions, library);
  const total =
    (cache === null ? 0 : cache.previews.bytes + cache.trickplay.bytes) +
    (cache?.sessions.bytes ?? 0) +
    (artwork?.bytes ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:justify-between">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-text-muted">
              {row.label}

              {row.hint === undefined ? null : (
                <HoverCard
                  side="top"
                  align="center"
                  detail={<p className="text-xs leading-relaxed normal-case">{row.hint}</p>}
                >
                  <Button
                    variant="bare"
                    size="none"
                    isIconOnly
                    label={`What ${row.label.toLowerCase()} means`}
                    hasTooltip={false}
                    className="text-text-muted transition-colors hover:text-text"
                  >
                    <Icon of={InformationCircleIcon} size={14} />
                  </Button>
                </HoverCard>
              )}
            </dt>
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
          : `${formatBytes(total)} of Valence's own files · counted ${describeSince(
              new Date(cache?.atMs ?? artwork?.atMs ?? 0).toISOString(),
              Date.now(),
            )}`}
      </p>
    </div>
  );
};

CacheBreakdown.displayName = 'CacheBreakdown';

export { CacheBreakdown };
