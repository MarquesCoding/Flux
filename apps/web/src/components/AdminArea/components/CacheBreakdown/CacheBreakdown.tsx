import { RiInformationLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { HoverCard } from '@FluxUI/HoverCard';
import { formatBytes } from '@FluxCore/functions/formatBytes';
import { describeSince } from '@FluxWeb/components/AdminArea/describeSince';
import { cacheRows } from './cacheRows';
import type { CacheBreakdownProps } from './CacheBreakdown.types';

/**
 * What Flux itself is keeping on the disk.
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
                    <RiInformationLine size={14} aria-hidden />
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
          : `${formatBytes(total)} of Flux's own files · counted ${describeSince(
              new Date(cache?.atMs ?? artwork?.atMs ?? 0).toISOString(),
              Date.now(),
            )}`}
      </p>
    </div>
  );
};

CacheBreakdown.displayName = 'CacheBreakdown';

export { CacheBreakdown };
