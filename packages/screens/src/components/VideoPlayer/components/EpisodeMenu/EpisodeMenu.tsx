import { Icon } from '@ValenceUI/Icon';
import { PlaylistIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PopoverPanel } from '@ValenceUI/PopoverPanel';
import { MediaCard } from '@ValenceUI/MediaCard';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import type { EpisodeMenuProps } from './EpisodeMenu.types';

/**
 * Builds the address of an episode's still, which the menu shows beside each row so a viewer picks
 * by what they remember seeing rather than by episode number.
 *
 * @param mediaId - The episode.
 * @returns Where to fetch its picture.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * Names a season for the heading above its episodes, falling back to a neutral heading for anything
 * the scanner could not place in one.
 *
 * @param seasonNumber - The season, where it is known.
 * @returns What to call it.
 */
const headingOf = (seasonNumber: number | null | undefined): string =>
  typeof seasonNumber === 'number' ? `Season ${seasonNumber.toString()}` : 'Episodes';

/**
 * Offers the rest of the season without leaving the player, grouped by season and marked with how far
 * the viewer got through each episode, so the next one is one press away rather than a trip back to
 * the programme's page.
 *
 * @param episodes - The season's episodes.
 * @param playingId - Which one is on now.
 * @param onSelect - Called with the episode they chose.
 * @param watchedFractionFor - How to ask how far through a given episode they are.
 * @param onOpenChange - Called as the menu opens or closes, so the bar stays put while it is open.
 * @param isDisabled - Whether the menu is inert, as it is while a session is starting.
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
      trigger={isOpen ? <Icon of={PlaylistIcon} size={20} /> : <Icon of={PlaylistIcon} size={20} />}
      className="w-80 sm:w-96 mb-7.5"
    >
      <ul className="flex flex-col gap-3">
        {episodes.map((episode) => (
          <li key={episode.id} className="flex items-start gap-3">
            <span className="w-5 shrink-0 pt-1 text-right text-sm tabular-nums text-on-scrim/50">
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
