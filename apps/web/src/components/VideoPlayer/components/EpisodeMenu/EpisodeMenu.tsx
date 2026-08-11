import { useState } from 'react';
import { IconArticle, IconArticleFilled } from '@tabler/icons-react';
import { PopoverPanel } from '@FluxUI/PopoverPanel';
import { MediaCard } from '@FluxUI/MediaCard';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import type { EpisodeMenuProps } from './EpisodeMenu.types';

/**
 * Where an episode's picture comes from.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * What a season is called at the top of the list.
 */
const headingOf = (seasonNumber: number | null | undefined): string =>
  typeof seasonNumber === 'number' ? `Season ${seasonNumber.toString()}` : 'Episodes';

/**
 * The rest of the season, without leaving the film.
 *
 * Somebody four episodes into a series does not want to close the player, find
 * the page, and pick the next one; they want the list where they already are.
 * The same card the library draws episodes with, so an episode looks like an
 * episode wherever it is met — including how far through it this viewer is.
 */
const EpisodeMenu = ({
  episodes,
  playingId,
  onSelect,
  watchedFractionFor,
  onOpenChange,
  isDisabled = false,
}: EpisodeMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const show = (next: boolean) => {
    setIsOpen(next);
    onOpenChange?.(next);
  };

  if (episodes.length === 0) {
    return null;
  }

  const playing = episodes.find((episode) => episode.id === playingId) ?? null;

  return (
    <PopoverPanel
      label="Episodes"
      heading={headingOf(playing?.seasonNumber)}
      isDisabled={isDisabled}
      isOpen={isOpen}
      onOpenChange={show}
      trigger={
        isOpen ? <IconArticleFilled size={20} aria-hidden /> : <IconArticle size={20} aria-hidden />
      }
      className="w-80 sm:w-96 mb-7.5"
    >
      <ul className="flex flex-col gap-3">
        {episodes.map((episode) => (
          <li key={episode.id} className="flex items-start gap-3">
            <span className="w-5 shrink-0 pt-1 text-right text-sm tabular-nums text-white/50">
              {episode.episodeNumber ?? ''}
            </span>

            <span className="min-w-0 flex-1">
              <MediaCard
                title={episode.title}
                subtitle={
                  episode.id === playingId ? 'Playing' : formatDuration(episode.durationSeconds)
                }
                shape="wide"
                {...(watchedFractionFor?.(episode.id) === undefined
                  ? {}
                  : { watchedFraction: watchedFractionFor(episode.id) ?? 0 })}
                {...(episode.hasBackdrop ? { imageUrl: artworkUrl(episode.id) } : {})}
                isStill
                onSelect={() => {
                  show(false);
                  onSelect(episode);
                }}
                className={episode.id === playingId ? 'opacity-60' : ''}
              />
            </span>
          </li>
        ))}
      </ul>
    </PopoverPanel>
  );
};

EpisodeMenu.displayName = 'EpisodeMenu';

export { EpisodeMenu };
