import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { IconInfoCircle, IconPlayerPlayFilled, IconX } from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { Badge } from '@FluxUI/Badge';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { fetchShow } from '@FluxWeb/library/fetchShows';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { scrollToTopOf } from '@FluxWeb/navigation/scrollToTopOf';
import { pickUpFrom } from './pickUpFrom';
import { EpisodeRow } from './components/EpisodeRow/EpisodeRow';
import type { ShowDetail } from '@FluxContracts/schemas/Show';
import type { ShowDialogProps } from './ShowDialog.types';

/**
 * Where the artwork of a show comes from.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * Names a season the way somebody would say it.
 */
const nameSeason = (seasonNumber: number | null): string =>
  seasonNumber === null
    ? 'Specials'
    : seasonNumber === 0
      ? 'Specials'
      : `Season ${seasonNumber.toString()}`;

/**
 * A series, and everywhere you could go in it.
 *
 * Opened from a shelf of shows rather than from an episode, because a viewer
 * looking at ten cards of the same programme is looking at one programme. The
 * page about an episode still exists and is one press away; this is the page
 * about the thing that contains them.
 *
 * It leads with one button. Somebody halfway through means the episode they
 * stopped in; somebody who finished it means the next; somebody who has never
 * seen it means the first — and all three are the same press, because finding
 * your place in a list of ninety is the library's job rather than the
 * viewer's.
 */
const ShowDialog = ({
  show,
  onClose,
  onPlay,
  onInspect,
  watchedFractionFor,
  resumeFor,
  isFinished,
}: ShowDialogProps) => {
  const [detail, setDetail] = useState<ShowDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastShown, setLastShown] = useState(show);
  const [chosenSeason, setChosenSeason] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (show === null) {
      return;
    }

    setLastShown(show);
    setDetail(null);
    setIsLoading(true);

    let abandoned = false;

    void fetchShow(show.libraryId, show.id).then((found) => {
      if (abandoned) {
        return;
      }

      setDetail(found);
      setIsLoading(false);

      const carryingOn = found === null ? null : pickUpFrom(found, { resumeFor, isFinished });

      setChosenSeason(carryingOn?.episode.seasonNumber ?? null);
    });

    const returning = requestAnimationFrame(() => {
      scrollToTopOf(topRef.current, prefersReducedMotion !== true);
    });

    return () => {
      abandoned = true;
      cancelAnimationFrame(returning);
    };
  }, [show, prefersReducedMotion]);

  const shown = show ?? lastShown;

  if (shown === null) {
    return null;
  }

  const seasons = detail?.seasons ?? [];
  const season = seasons.find((one) => one.seasonNumber === chosenSeason) ??
    seasons[0] ?? { seasonNumber: null, episodes: [] };
  const carryingOn = detail === null ? null : pickUpFrom(detail, { resumeFor, isFinished });

  return (
    <Dialog
      label={shown.title}
      isOpen={show !== null}
      onClose={onClose}
      className="h-full w-full max-w-none rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-3xl"
    >
      <div ref={topRef} className="relative">
        <div className="h-[34vh] min-h-[14rem] sm:h-[22rem]">
          <MediaPreview
            mediaId={shown.coverMediaId}
            backdropUrl={artworkUrl(shown.coverMediaId)}
            durationSeconds={0}
            settleMilliseconds={0}
            fills
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

        <div className="absolute right-4 top-4">
          <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
            <IconX size={20} aria-hidden />
          </Button>
        </div>

        <motion.div
          variants={staggerVariants}
          initial="hidden"
          animate="shown"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:p-8"
        >
          <motion.div
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion)}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-text-muted">
              {shown.seasonCount === 1
                ? `${shown.episodeCount.toString()} episodes`
                : `${shown.seasonCount.toString()} seasons · ${shown.episodeCount.toString()} episodes`}
            </span>

            {(shown.genres ?? []).length === 0 ? null : (
              <span className="flex flex-wrap gap-1.5">
                {(shown.genres ?? []).slice(0, 3).map((genre) => (
                  <Badge key={genre} size="sm" className="bg-surface/70 backdrop-blur">
                    {genre}
                  </Badge>
                ))}
              </span>
            )}
          </motion.div>

          <motion.h2
            variants={revealVariants(prefersReducedMotion)}
            transition={revealTransition(prefersReducedMotion, 'heavy')}
            className="max-w-[16ch] text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-text"
          >
            {shown.title}
          </motion.h2>
        </motion.div>
      </div>

      <div className="flex flex-col gap-8 p-5 pb-10 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          {carryingOn === null ? (
            <Button variant="glossy" size="lg" isPill isLoading disabled>
              Reading the episodes
            </Button>
          ) : (
            <Button
              variant="glossy"
              size="lg"
              isPill
              onClick={() => {
                onPlay(carryingOn.episode, carryingOn.startSeconds);
              }}
            >
              <IconPlayerPlayFilled size={18} aria-hidden />
              {carryingOn.isResuming
                ? `Resume ${formatDuration(carryingOn.startSeconds)}`
                : `Play ${nameSeason(carryingOn.episode.seasonNumber ?? null)}, episode ${(
                    carryingOn.episode.episodeNumber ?? 1
                  ).toString()}`}
            </Button>
          )}

          {carryingOn === null || onInspect === undefined ? null : (
            <Button
              variant="secondary"
              size="lg"
              isPill
              onClick={() => {
                onInspect(carryingOn.episode);
              }}
            >
              <IconInfoCircle size={18} aria-hidden />
              About this episode
            </Button>
          )}
        </div>

        <section className="flex flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
              Episodes
            </h3>

            {seasons.length < 2 ? null : (
              <ul className="flux-rail flex items-center gap-2 overflow-x-auto">
                {seasons.map((one) => (
                  <li key={one.seasonNumber ?? 'specials'}>
                    <Button
                      size="sm"
                      isPill
                      aria-pressed={one.seasonNumber === season.seasonNumber}
                      variant={one.seasonNumber === season.seasonNumber ? 'glossy' : 'ghost'}
                      onClick={() => {
                        setChosenSeason(one.seasonNumber);
                      }}
                    >
                      {nameSeason(one.seasonNumber)}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </header>

          {isLoading ? (
            <Spinner label="Reading the episodes" size="sm" />
          ) : season.episodes.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nothing here yet. Episodes appear as they are scanned.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5">
              {season.episodes.map((episode) => (
                <li key={episode.id}>
                  <EpisodeRow
                    episode={episode}
                    onPlay={onPlay}
                    {...(onInspect === undefined ? {} : { onInspect })}
                    {...(watchedFractionFor?.(episode.id) === undefined
                      ? {}
                      : { watchedFraction: watchedFractionFor(episode.id) ?? 0 })}
                    {...(resumeFor === undefined || resumeFor(episode.id) === null
                      ? {}
                      : { resumeSeconds: Math.floor(resumeFor(episode.id) ?? 0) })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
};

ShowDialog.displayName = 'ShowDialog';

export { ShowDialog };
