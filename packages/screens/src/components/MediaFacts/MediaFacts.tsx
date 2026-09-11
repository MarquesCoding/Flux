import { Icon } from '@ValenceUI/Icon';
import { StarIcon } from '@hugeicons/core-free-icons';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import type { ReactNode } from 'react';
import type { MediaFactsProps } from './MediaFacts.types';

/**
 * States the facts that place an item — its year, how long it runs, which episode it is, what it is
 * rated — on one line beneath its name. Which of them appear is up to the caller, since a card in a
 * grid and a page about one film want different amounts.
 *
 * @param media - The item being described.
 * @param hasRuntime - Whether to say how long it is.
 * @param hasEpisode - Whether to say which episode it is.
 * @param className - Extra classes for the caller's own layout.
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
                <Icon of={StarIcon} size={14} />
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
