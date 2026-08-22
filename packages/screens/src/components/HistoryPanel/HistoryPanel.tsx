import { Icon } from '@ValenceUI/Icon';
import { CheckIcon, TrashIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { Badge } from '@ValenceUI/Badge';
import { Spinner } from '@ValenceUI/Spinner';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { forgetViewing, forgetHistory } from '@ValenceClient/history/fetchHistory';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { viewingQueries } from '@ValenceClient/query/viewingQueries';
import { describeWhen } from '@ValenceClient/history/describeWhen';
import type { Viewing } from '@ValenceContracts/schemas/Viewing';
import type { HistoryPanelProps } from './HistoryPanel.types';
import type { InfiniteData } from '@tanstack/react-query';

/**
 * Names something in the history that has since left the library, since a viewing outlives the file
 * it was of — the alternative is a row saying nothing at all.
 *
 * @param viewing - The viewing as recorded.
 * @returns What to call it.
 */
const nameOf = (viewing: Viewing): string => viewing.title ?? 'No longer in the library';

/**
 * What this profile has watched, grouped by when — today, yesterday, the days of this week — with
 * each viewing removable, since a history somebody cannot edit is a history they will not want.
 *
 * @param now - What to treat as now, so the grouping can be tested.
 */
const HistoryPanel = ({ now }: HistoryPanelProps) => {
  const [isClearing, setIsClearing] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const cache = useQueryClient();

  const asked = useInfiniteQuery(viewingQueries.history());

  const viewings = useMemo(() => (asked.data?.pages ?? []).flat(), [asked.data]);
  const isReading = asked.isPending;
  const hasMore = asked.hasNextPage;

  const readMore = async () => {
    await asked.fetchNextPage();
  };

  const forgetOne = async (viewingId: string) => {
    cache.setQueryData(
      viewingQueries.history().queryKey,
      (held: InfiniteData<Viewing[]> | undefined) =>
        held === undefined
          ? held
          : {
              ...held,
              pages: held.pages.map((page) => page.filter((one) => one.id !== viewingId)),
            },
    );

    if (!(await forgetViewing(viewingId))) {
      await cache.invalidateQueries({ queryKey: viewingQueries.history().queryKey });
    }
  };

  const forgetTheLot = async () => {
    setIsClearing(true);
    await forgetHistory();
    await cache.invalidateQueries({ queryKey: viewingQueries.history().queryKey });
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
                  <Icon of={CheckIcon} size={12} />
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
                <Icon of={TrashIcon} size={16} />
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
          <Icon of={TrashIcon} size={16} />
          Forget everything
        </Button>
      </div>
    </div>
  );
};

HistoryPanel.displayName = 'HistoryPanel';

export { HistoryPanel };
