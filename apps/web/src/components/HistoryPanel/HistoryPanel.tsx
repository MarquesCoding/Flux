import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RiCheckLine, RiDeleteBinLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Badge } from '@FluxUI/Badge';
import { Spinner } from '@FluxUI/Spinner';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { fetchHistory, forgetViewing, forgetHistory, A_PAGE } from '@FluxWeb/history/fetchHistory';
import { describeWhen } from '@FluxWeb/history/describeWhen';
import type { Viewing } from '@FluxContracts/schemas/Viewing';
import type { HistoryPanelProps } from './HistoryPanel.types';

/**
 * What to call something that has since left the library.
 */
const nameOf = (viewing: Viewing): string => viewing.title ?? 'No longer in the library';

/**
 * What this profile has watched.
 */
const HistoryPanel = ({ now }: HistoryPanelProps) => {
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [isReading, setIsReading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const read = useCallback(async () => {
    const first = await fetchHistory(0);

    setViewings(first);
    setHasMore(first.length === A_PAGE);
    setIsReading(false);
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  const readMore = async () => {
    const next = await fetchHistory(viewings.length);

    setViewings((held) => [...held, ...next]);
    setHasMore(next.length === A_PAGE);
  };

  const forgetOne = async (viewingId: string) => {
    setViewings((held) => held.filter((one) => one.id !== viewingId));

    if (!(await forgetViewing(viewingId))) {
      await read();
    }
  };

  const forgetTheLot = async () => {
    setIsClearing(true);
    await forgetHistory();
    setViewings([]);
    setHasMore(false);
    setIsClearing(false);
  };

  if (isReading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner label="Reading your history" />
      </div>
    );
  }

  if (viewings.length === 0) {
    return (
      <p className="p-4 text-sm text-text-muted">
        Nothing yet. What you watch shows up here, and only you can see it.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
        <AnimatePresence initial={false} mode="popLayout">
          {viewings.map((viewing) => (
            <motion.li
              key={viewing.id}
              layout={!(prefersReducedMotion ?? false)}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: prefersReducedMotion === true ? 0 : 0.18 }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm text-text-strong">{nameOf(viewing)}</span>

                <span className="text-xs text-text-muted">
                  {viewing.seriesTitle === null ? '' : `${viewing.seriesTitle} · `}
                  {describeWhen(new Date(viewing.lastWatchedAt), now ?? new Date())} ·{' '}
                  {formatDuration(viewing.secondsWatched)} watched
                </span>
              </div>

              {viewing.isFinished ? (
                <Badge tone="accent">
                  <RiCheckLine size={12} aria-hidden />
                  Finished
                </Badge>
              ) : null}

              <Button
                variant="ghost"
                size="sm"
                isPill
                className="ml-auto shrink-0"
                aria-label={`Forget ${nameOf(viewing)}`}
                onClick={() => {
                  void forgetOne(viewing.id);
                }}
              >
                <RiDeleteBinLine size={16} aria-hidden />
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-line)] p-4">
        {hasMore ? (
          <Button
            variant="ghost"
            size="sm"
            isPill
            onClick={() => {
              void readMore();
            }}
          >
            Show more
          </Button>
        ) : (
          <p className="text-xs text-text-muted">
            Viewings are forgotten automatically after a year.
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          isPill
          disabled={isClearing}
          className="ml-auto"
          onClick={() => {
            void forgetTheLot();
          }}
        >
          <RiDeleteBinLine size={16} aria-hidden />
          Forget everything
        </Button>
      </div>
    </div>
  );
};

HistoryPanel.displayName = 'HistoryPanel';

export { HistoryPanel };
