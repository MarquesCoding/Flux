import { IconStar } from '@tabler/icons-react';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import type { ReactNode } from 'react';
import type { MediaFactsProps } from './MediaFacts.types';

/**
 * Everything that places an item, on one line.
 *
 * Where it sits in its series, what it scored, and when it was made —
 * separated by dots rather than by space alone, so four facts read as a list
 * rather than as a row of unrelated numbers.
 *
 * One component because the hero and every card say the same things about the
 * same items, and two versions of this line is two chances to describe one
 * film two ways.
 *
 * Whatever is not known is left out rather than shown empty. A film has no
 * episode, plenty of things have no rating, and a line of placeholders is
 * worse than a shorter line.
 */
const MediaFacts = ({
  media,
  className,
  hasRuntime = false,
  hasEpisode = true,
}: MediaFactsProps) => {
  const rating = media.rating ?? null;

  const facts: { key: string; said: ReactNode }[] = [
    ...(hasEpisode && typeof media.episodeNumber === 'number'
      ? [{ key: 'episode', said: <span className="tabular-nums">EP{media.episodeNumber}</span> }]
      : []),
    ...(hasEpisode && typeof media.seasonNumber === 'number'
      ? [{ key: 'season', said: <span className="tabular-nums">S{media.seasonNumber}</span> }]
      : []),
    ...(rating === null
      ? []
      : [
          {
            key: 'rating',
            said: (
              <span className="flex items-center gap-1.5 tabular-nums">
                <IconStar size={14} aria-hidden />
                {rating.toFixed(1)}
              </span>
            ),
          },
        ]),
    ...(media.year === null
      ? []
      : [{ key: 'year', said: <span className="tabular-nums">{media.year}</span> }]),
    ...(hasRuntime
      ? [
          {
            key: 'runtime',
            said: <span className="tabular-nums">{formatDuration(media.durationSeconds)}</span>,
          },
        ]
      : []),
  ];

  if (facts.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {facts.map((fact, at) => (
        <span key={fact.key} className="flex items-center gap-2">
          {at === 0 ? null : <span aria-hidden>·</span>}
          {fact.said}
        </span>
      ))}
    </span>
  );
};

MediaFacts.displayName = 'MediaFacts';

export { MediaFacts };
