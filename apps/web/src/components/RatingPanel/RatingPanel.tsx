import { useEffect, useState } from 'react';
import { StarRating } from '@FluxUI/StarRating';
import { cn } from '@FluxUI/cn';
import { fetchHouseholdRating } from '@FluxWeb/library/fetchRatings';
import type { HouseholdRating } from '@FluxContracts/schemas/Rating';
import type { RatingPanelProps } from './RatingPanel.types';

const NOTHING: HouseholdRating = { average: null, count: 0 };

/**
 * Says how many people gave a rating in words that read properly at one, since "1 ratings" is the
 * sort of thing that makes an interface look unfinished.
 *
 * @param count - How many gave it.
 * @returns The phrase to show beside the average.
 */
const describeCount = (count: number): string =>
  count === 1 ? 'from 1 rating' : `from ${count.toString()} ratings`;

/**
 * What this viewer thinks of something and what the rest of the household thinks, side by side. The
 * viewer's row is pressable and the household's is not — one is an opinion being given, the other is
 * everyone's opinions already given, and they are different things wearing the same stars.
 *
 * Re-reads the household figure whenever this viewer's rating changes, since their own rating is
 * part of that average and a figure that ignored the star just pressed would look broken.
 *
 * @param subject - The item or programme being rated.
 * @param title - What is being rated, for anybody not looking at the screen.
 * @param stars - What this viewer gave it, or null where they have not.
 * @param onRate - Called with what they gave it, or null to take it back.
 * @param className - Extra classes for the caller's own layout.
 */
const RatingPanel = ({ subject, title, stars, onRate, className }: RatingPanelProps) => {
  const [household, setHousehold] = useState<HouseholdRating>(NOTHING);
  const mediaId = 'mediaId' in subject ? subject.mediaId : null;
  const seriesId = 'seriesId' in subject ? subject.seriesId : null;

  useEffect(() => {
    let isCurrent = true;

    void fetchHouseholdRating(mediaId === null ? { seriesId: seriesId ?? '' } : { mediaId }).then(
      (found) => {
        if (isCurrent) {
          setHousehold(found);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [mediaId, seriesId, stars]);

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">Ratings</h3>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.16em] text-text-muted">You</span>

          <StarRating
            stars={stars}
            label={title}
            onRate={(given) => {
              onRate(given);
            }}
            onClear={() => {
              onRate(null);
            }}
          />
        </div>

        {household.average === null ? null : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.16em] text-text-muted">Household</span>

            <span className="flex items-center gap-2">
              <StarRating stars={household.average} label={`${title}, household`} size="sm" />
              <span className="text-sm tabular-nums text-text">{household.average.toFixed(1)}</span>
              <span className="font-body text-xs text-text-muted">
                {describeCount(household.count)}
              </span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

RatingPanel.displayName = 'RatingPanel';

export { RatingPanel };
