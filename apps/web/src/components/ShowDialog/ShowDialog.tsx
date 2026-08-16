import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { RiCloseLine, RiInformationLine, RiPlayFill } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { Badge } from '@FluxUI/Badge';
import { Spinner } from '@FluxUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { fetchShow } from '@FluxWeb/library/fetchShows';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { scrollToTopOf } from '@FluxWeb/navigation/scrollToTopOf';
import { pickUpFrom } from './pickUpFrom';
import { EpisodeRow } from './components/EpisodeRow/EpisodeRow';
import { MissingRow } from './components/MissingRow/MissingRow';
import { findGaps } from '@FluxCore/functions/findGaps';
import type { ShowDetail } from '@FluxContracts/schemas/Show';
import type { ShowDialogProps } from './ShowDialog.types';

/**
 * Builds the address a programme's artwork is served from, which is one of its episodes' — a
 * programme is not stored anywhere and so has no artwork of its own.
 *
 * @param show - The programme being drawn.
 * @returns The address to load.
 */
const artworkUrl = (mediaId: string): string => `/api/media/${mediaId}/image/backdrop`;

/**
 * Names a season the way somebody would say it, giving specials their own name rather than calling
 * them season zero.
 *
 * @param seasonNumber - The season.
 * @returns What to call it.
 */
const nameSeason = (seasonNumber: number | null): string =>
  seasonNumber === null
    ? 'Specials'
    : seasonNumber === 0
      ? 'Specials'
      : `Season ${seasonNumber.toString()}`;

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

  const [unlettered, setUnlettered] = useState<string | null>(null);
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
    <Dialog
      label={shown.title}
      isOpen={show !== null}
      onClose={onClose}
      className="h-full w-full max-w-none rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-3xl"
    >
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

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

          <div className="absolute right-4 top-4">
            <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
              <RiCloseLine size={20} aria-hidden />
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
                <RiPlayFill size={18} aria-hidden />
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
                <RiInformationLine size={18} aria-hidden />
                About this episode
              </Button>
            )}
          </div>

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

            {isLoading ? (
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
