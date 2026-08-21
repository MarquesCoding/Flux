import { Icon } from '@FluxUI/Icon';
import { InfoIcon, LinkIcon, PlayIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@FluxUI/Button';
import { nameSeason } from '@FluxClient/library/nameSeason';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { BackdropScrim } from '@FluxUI/BackdropScrim';
import { Badge } from '@FluxUI/Badge';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { CouldNotRead } from '@FluxUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { useHeldWhileLeaving } from '@FluxClient/shell/useHeldWhileLeaving';
import { libraryQueries } from '@FluxClient/query/libraryQueries';
import { MediaPreview } from '@FluxScreens/components/MediaPreview/MediaPreview';
import { scrollToTopOf } from '@FluxScreens/navigation/scrollToTopOf';
import { RatingPanel } from '@FluxScreens/components/RatingPanel/RatingPanel';
import { pickUpFrom } from './pickUpFrom';
import { EpisodeRow } from './components/EpisodeRow/EpisodeRow';
import { MissingRow } from './components/MissingRow/MissingRow';
import { findGaps } from '@FluxCore/functions/findGaps';
import type { ShowDialogProps } from './ShowDialog.types';

/**
 * Builds the address a programme's artwork is served from, which is one of its episodes' — a
 * programme is not stored anywhere and so has no artwork of its own.
 *
 * @param mediaId - The programme being drawn.
 * @returns The address to load.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * A programme in full: its seasons, its episodes, where a viewer got to in each, and the episodes
 * the catalogue says exist that this library does not have. Opening it is how somebody decides what
 * to watch next rather than only what to watch now.
 *
 * @param show - The programme, or null while none is open.
 * @param onClose - Told when the dialog was dismissed.
 * @param onPlay - Told to start an episode, and where from.
 * @param onInspect - Told to open the page about an episode.
 * @param watchedFractionFor - How far through each episode this viewer is.
 * @param resumeFor - Where they left each episode.
 * @param isFinished - Whether they have finished each episode.
 * @param stars - What this viewer gave the programme, or null where they have not rated it.
 * @param onRate - Told what they gave it, or null to take the rating back. Offered only for a
 *   programme the scanner resolved to a series of its own, since a rating is keyed on that.
 */
const ShowDialog = ({
  show,
  onClose,
  onPlay,
  onInspect,
  onShare,
  watchedFractionFor,
  resumeFor,
  isFinished,
  stars = null,
  onRate,
}: ShowDialogProps) => {
  const [unlettered, setUnlettered] = useState<string | null>(null);
  const [lastShown, setLastShown] = useState(show);
  const [chosenSeason, setChosenSeason] = useState<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const asked = useQuery(libraryQueries.show(show?.libraryId ?? null, show?.id ?? null));
  const detail = useHeldWhileLeaving(asked.data ?? null, show !== null);
  const isLoading = show !== null && asked.isPending;

  const carryOnRef = useRef({ resumeFor, isFinished });

  carryOnRef.current = { resumeFor, isFinished };

  useEffect(() => {
    if (show === null) {
      return;
    }

    setLastShown(show);

    const returning = requestAnimationFrame(() => {
      scrollToTopOf(topRef.current, prefersReducedMotion !== true);
    });

    return () => {
      cancelAnimationFrame(returning);
    };
  }, [show, prefersReducedMotion]);

  useEffect(() => {
    if (detail === null) {
      return;
    }

    setChosenSeason(pickUpFrom(detail, carryOnRef.current)?.episode.seasonNumber ?? null);
  }, [detail]);

  const shown = show ?? lastShown;

  if (shown === null) {
    return null;
  }

  const seasons = detail?.seasons ?? [];

  const lettered =
    seasons.flatMap((one) => one.episodes).find((episode) => episode.hasLogo) ?? null;
  const carryingOn = detail === null ? null : pickUpFrom(detail, { resumeFor, isFinished });
  const gaps = detail === null ? null : findGaps(detail);

  const chooseFrom = [
    ...seasons.map((one) => ({ seasonNumber: one.seasonNumber, isHeld: true })),
    ...(gaps?.seasons ?? []).map((number) => ({ seasonNumber: number, isHeld: false })),
  ].sort((left, right) => (left.seasonNumber ?? Infinity) - (right.seasonNumber ?? Infinity));

  const chosen = chooseFrom.find((one) => one.seasonNumber === chosenSeason) ?? chooseFrom[0];
  const showing = chosen?.seasonNumber ?? null;
  const season = seasons.find((one) => one.seasonNumber === showing) ?? {
    seasonNumber: showing,
    episodes: [],
  };

  const listedHere = (detail?.shape ?? []).find((one) => one.seasonNumber === (showing ?? -1));

  const missingHere =
    chosen?.isHeld === false
      ? (listedHere?.episodes.map((one) => one.episodeNumber) ?? [])
      : (gaps?.episodes.get(showing ?? -1) ?? []);

  const inOrder = [
    ...season.episodes.map((episode) => ({
      key: episode.id,
      at: episode.episodeNumber ?? 0,
      episode,
      listed: null,
    })),
    ...missingHere.map((number) => ({
      key: `missing-${number.toString()}`,
      at: number,
      episode: null,
      listed: listedHere?.episodes.find((one) => one.episodeNumber === number) ?? null,
    })),
  ].sort((left, right) => left.at - right.at);

  return (
    <Dialog label={shown.title} isOpen={show !== null} onClose={onClose} size="stage">
      <DialogContent className="p-0">
        <div ref={topRef} className="relative">
          <div className="h-[34vh] min-h-[14rem] sm:h-[22rem]">
            <MediaPreview
              mediaId={shown.coverMediaId}
              backdropUrl={artworkUrl(shown.coverMediaId)}
              durationSeconds={0}
              fills
            />
          </div>

          <BackdropScrim />

          <div className="absolute right-4 top-4">
            <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
              <Icon of={XIcon} size={20} />
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
              className="flex flex-wrap items-center gap-3"
            >
              <span className="text-sm font-medium uppercase tracking-[0.2em] text-text-muted">
                {shown.seasonCount === 1
                  ? `${shown.episodeCount.toString()} episodes`
                  : `${shown.seasonCount.toString()} seasons · ${shown.episodeCount.toString()} episodes`}
              </span>
            </motion.div>

            <motion.h2
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion, 'heavy')}
              className={
                lettered === null || unlettered === lettered.id
                  ? 'max-w-[16ch] text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-text'
                  : 'flex'
              }
            >
              {lettered === null || unlettered === lettered.id ? (
                shown.title
              ) : (
                <img
                  src={`/api/media/${lettered.id}/image/logo`}
                  alt={shown.title}
                  className="max-h-[16svh] w-auto max-w-[min(70vw,26rem)] object-contain object-left"
                  onError={() => {
                    setUnlettered(lettered.id);
                  }}
                />
              )}
            </motion.h2>

            {(shown.genres ?? []).length === 0 ? null : (
              <motion.span
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="flex flex-wrap gap-1.5"
              >
                {(shown.genres ?? []).slice(0, 3).map((genre) => (
                  <Badge key={genre} size="sm" className="bg-surface/70 backdrop-blur">
                    {genre}
                  </Badge>
                ))}
              </motion.span>
            )}
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
                <Icon of={PlayIcon} size={18} />
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
                <Icon of={InfoIcon} size={18} />
                About this episode
              </Button>
            )}

            {onShare === undefined || (shown.seriesId ?? null) === null ? null : (
              <Button
                variant="secondary"
                size="lg"
                isPill
                onClick={() => {
                  onShare(shown);
                }}
              >
                <Icon of={LinkIcon} size={18} />
                Share
              </Button>
            )}
          </div>

          {onRate === undefined || (shown.seriesId ?? null) === null ? null : (
            <RatingPanel
              subject={{ seriesId: shown.seriesId ?? '' }}
              title={shown.title}
              stars={stars}
              onRate={(given) => {
                onRate(shown, given);
              }}
            />
          )}

          <section className="flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                Episodes
              </h3>

              {seasons.length < 2 && (gaps?.seasons ?? []).length === 0 ? null : (
                <ul className="flux-rail flex items-center gap-2 overflow-x-auto">
                  {chooseFrom.map((one) => (
                    <li key={one.seasonNumber ?? 'specials'}>
                      <Button
                        size="sm"
                        isPill
                        aria-pressed={one.seasonNumber === showing}
                        variant={one.seasonNumber === showing ? 'glossy' : 'ghost'}
                        className={one.isHeld ? '' : 'border border-dashed border-white/25'}
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

            {show !== null && asked.isError ? (
              <CouldNotRead
                what="The episodes"
                isTryingAgain={asked.isFetching}
                onTryAgain={() => {
                  void asked.refetch();
                }}
              />
            ) : isLoading ? (
              <Spinner label="Reading the episodes" size="sm" />
            ) : inOrder.length === 0 ? (
              <p className="text-sm text-text-muted">
                Nothing here yet. Episodes appear as they are scanned.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-white/5">
                {inOrder.map(({ key, at, episode, listed }) => (
                  <li key={key}>
                    {episode === null ? (
                      <MissingRow
                        episodeNumber={at}
                        {...(listed === null ? {} : { title: listed.title })}
                        {...(listed?.stillUrl === null || listed?.stillUrl === undefined
                          ? {}
                          : { stillUrl: listed.stillUrl })}
                      />
                    ) : (
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
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

ShowDialog.displayName = 'ShowDialog';

export { ShowDialog };
