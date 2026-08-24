import { Icon } from '@ValenceUI/Icon';
import { InfoIcon, PlayIcon } from '@phosphor-icons/react';
import { Button } from '@ValenceUI/Button';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import type { EpisodeRowProps } from './EpisodeRow.types';

/**
 * Builds the address an episode's still is served from, so a row is chosen by what somebody remembers
 * seeing rather than by its number.
 *
 * @param mediaId - The episode.
 * @returns The address to load.
 */
const stillUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * One episode in a list of them: its number, its name, how long it runs, what it is about, and how
 * far through it this viewer is.
 *
 * @param episode - The episode to draw.
 * @param onPlay - Told to start it, and where from.
 * @param onInspect - Told to open the page about it.
 * @param watchedFraction - How far through it this viewer is.
 * @param resumeSeconds - Where they left it.
 */
const EpisodeRow = ({
  episode,
  onPlay,
  onInspect,
  watchedFraction,
  resumeSeconds,
}: EpisodeRowProps) => (
  <div className="group/episode flex items-center gap-3 py-3">
    <Button
      variant="bare"
      size="none"
      aria-label={
        resumeSeconds === undefined
          ? `Play ${episode.title}`
          : `Resume ${episode.title} from ${formatDuration(resumeSeconds)}`
      }
      onClick={() => {
        onPlay(episode, resumeSeconds ?? 0);
      }}
      className="flex min-w-0 shrink flex-1 items-center gap-4 text-left"
    >
      <span className="w-8 shrink-0 text-center text-sm tabular-nums text-text-muted">
        {episode.episodeNumber ?? '—'}
      </span>

      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-raised ring-1 ring-line sm:w-36">
        {!episode.hasBackdrop ? null : (
          <img
            src={stillUrl(episode.id)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-shade/40 opacity-0 transition-opacity group-hover/episode:opacity-100">
          <Icon of={PlayIcon} size={20} className="text-on-scrim" />
        </span>

        {watchedFraction === undefined ? null : (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-shade/50">
            <span
              className="block h-full bg-primary"
              style={{ width: `${(Math.min(Math.max(watchedFraction, 0), 1) * 100).toString()}%` }}
            />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-text">{episode.title}</span>
        <span className="font-body text-xs text-text-muted">
          {formatDuration(episode.durationSeconds)}
          {resumeSeconds === undefined ? '' : ` · ${formatDuration(resumeSeconds)} in`}
        </span>
      </span>
    </Button>

    {onInspect === undefined ? null : (
      <Button
        isIconOnly
        variant="ghost"
        label={`About ${episode.title}`}
        size="sm"
        onClick={() => {
          onInspect(episode);
        }}
      >
        <Icon of={InfoIcon} size={18} />
      </Button>
    )}
  </div>
);

EpisodeRow.displayName = 'EpisodeRow';

export { EpisodeRow };
