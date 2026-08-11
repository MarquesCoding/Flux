import { Button } from '@FluxUI/Button';
import { IconInfoCircle, IconPlayerPlayFilled } from '@tabler/icons-react';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import type { EpisodeRowProps } from './EpisodeRow.types';

/**
 * Where the still for an episode comes from.
 */
const stillUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * One episode, in a list of them.
 *
 * A line rather than a card: a season is read down the page, and twelve cards
 * of the same programme is the thing this dialog exists to replace. The still
 * is small and the number is large, because in a list of episodes the number
 * is what somebody is looking for.
 *
 * The whole line plays it. Reading about it is a separate press, since that is
 * the rarer intention.
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

      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-raised ring-1 ring-white/10 sm:w-36">
        {!episode.hasBackdrop ? null : (
          <img
            src={stillUrl(episode.id)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/episode:opacity-100">
          <IconPlayerPlayFilled size={20} className="text-white" aria-hidden />
        </span>

        {watchedFraction === undefined ? null : (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <span
              className="block h-full bg-accent"
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
        <IconInfoCircle size={18} aria-hidden />
      </Button>
    )}
  </div>
);

EpisodeRow.displayName = 'EpisodeRow';

export { EpisodeRow };
