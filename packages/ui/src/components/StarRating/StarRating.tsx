import { useState } from 'react';
import { RiStarFill, RiStarLine } from '@remixicon/react';
import { cn } from '@FluxUI/cn';
import { Button } from '@FluxUI/Button';
import type { StarRatingProps, StarRatingSize } from './StarRating.types';

const STEPS = [1, 2, 3, 4, 5] as const;

const GLYPH_SIZES: Record<StarRatingSize, number> = { sm: 14, md: 18, lg: 24 };

const GAP_CLASSES: Record<StarRatingSize, string> = { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-1.5' };

/**
 * Shows a rating out of five as a row of stars, and takes one where it is given a way to report it.
 * Read-only it fills fractionally, so a household average of 4.2 is drawn as four stars and a fifth
 * mostly filled rather than rounded to something nobody gave it. Interactive it fills in whole steps
 * only, previews under a pointer, and treats pressing the star already given as taking the rating
 * back — which is the one gesture a row of stars otherwise has no room for.
 *
 * @param stars - What has been given, or null where nothing has.
 * @param label - What is being rated, for anybody not looking at the screen.
 * @param onRate - Called with the rating pressed; its absence is what makes the row read-only.
 * @param onClear - Called when the star already given is pressed again.
 * @param size - How large to draw the stars.
 * @param isDisabled - Whether the row is inert, as it is while a rating is being written.
 * @param className - Extra classes for the caller's own layout.
 */
const StarRating = ({
  stars,
  label,
  onRate,
  onClear,
  size = 'md',
  isDisabled = false,
  className,
}: StarRatingProps) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const glyph = GLYPH_SIZES[size];
  const given = stars ?? 0;

  if (onRate === undefined) {
    const filled = Math.min(Math.max(given, 0), STEPS.length) / STEPS.length;

    return (
      <span
        className={cn('relative inline-flex w-fit', GAP_CLASSES[size], className)}
        role="img"
        aria-label={`${label}: ${given.toFixed(1)} out of 5`}
      >
        <span className={cn('flex text-text-muted', GAP_CLASSES[size])} aria-hidden>
          {STEPS.map((step) => (
            <RiStarLine key={step} size={glyph} />
          ))}
        </span>

        <span
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ width: `${(filled * 100).toString()}%` }}
          aria-hidden
        >
          <span className={cn('flex text-amber-400', GAP_CLASSES[size])}>
            {STEPS.map((step) => (
              <RiStarFill key={step} size={glyph} />
            ))}
          </span>
        </span>
      </span>
    );
  }

  const shown = hovered ?? given;

  return (
    <span
      className={cn('inline-flex w-fit', GAP_CLASSES[size], className)}
      role="radiogroup"
      aria-label={label}
      onPointerLeave={() => {
        setHovered(null);
      }}
    >
      {STEPS.map((step) => {
        const isLit = step <= shown;
        const Glyph = isLit ? RiStarFill : RiStarLine;

        return (
          <Button
            key={step}
            variant="bare"
            size="none"
            isIconOnly
            role="radio"
            aria-checked={step === given}
            label={`${label}: ${step.toString()} of 5`}
            disabled={isDisabled}
            className={cn(
              'rounded-sm p-0.5 transition-transform',
              isLit ? 'text-amber-400' : 'text-text-muted',
              isDisabled ? '' : 'hover:scale-110',
            )}
            onPointerEnter={() => {
              setHovered(step);
            }}
            onFocus={() => {
              setHovered(step);
            }}
            onClick={() => {
              if (step === given) {
                onClear?.();

                return;
              }

              onRate(step);
            }}
          >
            <Glyph size={glyph} aria-hidden />
          </Button>
        );
      })}
    </span>
  );
};

StarRating.displayName = 'StarRating';

export { StarRating };
