import { Icon } from '@ValenceUI/Icon';
import { titleLogoUrl } from '@ValenceScreens/library/titleLogoUrl';
import { TitleLogo } from '@ValenceScreens/components/TitleLogo/TitleLogo';
import {
  Cancel01Icon,
  Download04Icon,
  InformationCircleIcon,
  Link01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotionConfig } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { nameSeason } from '@ValenceClient/library/nameSeason';
import { inSeasonOrder } from '@ValenceCore/functions/inSeasonOrder';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { ActionBar } from '@ValenceUI/ActionBar';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { useHasScrolledPast } from '@ValenceUI/useHasScrolledPast';
import { ScrolledTitle } from '@ValenceScreens/components/ScrolledTitle/ScrolledTitle';
import { BackdropScrim } from '@ValenceUI/BackdropScrim';
import { Badge } from '@ValenceUI/Badge';
import { canKeepFiles } from '@ValenceClient/downloads/canKeepFiles';
import { DownloadDialog } from '@ValenceScreens/components/DownloadDialog/DownloadDialog';
import { SegmentedRow } from '@ValenceUI/SegmentedRow';
import { Spinner } from '@ValenceUI/Spinner';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { useHeldWhileLeaving } from '@ValenceClient/shell/useHeldWhileLeaving';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { MediaPreview } from '@ValenceScreens/components/MediaPreview/MediaPreview';
import { scrollToTopOf } from '@ValenceScreens/navigation/scrollToTopOf';
import { RatingPanel } from '@ValenceScreens/components/RatingPanel/RatingPanel';
import { pickUpFrom } from './pickUpFrom';
import { EpisodeRow } from './components/EpisodeRow/EpisodeRow';
import { MissingRow } from './components/MissingRow/MissingRow';
import { findGaps } from '@ValenceCore/functions/findGaps';
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
  onRate,
}: ShowDialogProps) => {
  const [unlettered, setUnlettered] = useState<string | null>(null);
  const [lastShown, setLastShown] = useState(show);
  const [chosenSeason, setChosenSeason] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const { mark: pastTheArtwork, hasPassed: hasScrolledPast } = useHasScrolledPast();
  const prefersReducedMotion = useReducedMotionConfig();

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
  ].sort((left, right) => inSeasonOrder(left.seasonNumber, right.seasonNumber));

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
      <DialogContent className="p-3 sm:p-4">
        <ScrolledTitle
          title={shown.title}
          artwork={artworkUrl(shown.coverMediaId)}
          isShowing={hasScrolledPast}
        >
          <Button isIconOnly variant="ghost" size="sm" label="Close" onClick={onClose}>
            <Icon of={Cancel01Icon} size={16} />
          </Button>
        </ScrolledTitle>

        <div ref={topRef} className="relative overflow-hidden rounded-2xl">
          <div className="relative h-[34vh] min-h-[14rem] sm:h-[22rem]">
            <MediaPreview
              mediaId={shown.coverMediaId}
              backdropUrl={artworkUrl(shown.coverMediaId)}
              durationSeconds={0}
              fills
            />

            <BackdropScrim />
          </div>

          <div className="absolute right-4 top-4">
            <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
              <Icon of={Cancel01Icon} size={20} />
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
              <span className="text-sm font-medium uppercase tracking-[0.2em] text-on-scrim/75">
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
                  ? 'max-w-[16ch] text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-on-scrim'
                  : 'flex'
              }
            >
              {lettered === null || unlettered === lettered.id ? (
                shown.title
              ) : (
                <TitleLogo
                  src={titleLogoUrl(lettered.id)}
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
                  <Badge key={genre} size="sm" tone="solid">
                    {genre}
                  </Badge>
                ))}
              </motion.span>
            )}
          </motion.div>
        </div>

        <span ref={pastTheArtwork} aria-hidden className="block h-px" />

        <div className="flex flex-col gap-8 px-2 pb-4 pt-7 sm:px-4">
          {onRate === undefined || (shown.seriesId ?? null) === null ? null : (
            <RatingPanel
              subject={{ seriesId: shown.seriesId ?? '' }}
              title={shown.title}
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
                <SegmentedRow
                  size="sm"
                  label="Which season"
                  items={chooseFrom.map((one) => ({
                    id: String(one.seasonNumber ?? 'specials'),
                    label: nameSeason(one.seasonNumber),
                    ...(one.isHeld ? {} : { isAbsent: true }),
                  }))}
                  value={String(showing ?? 'specials')}
                  onSelect={(chosen) => {
                    setChosenSeason(chosen === 'specials' ? null : Number(chosen));
                  }}
                />
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
              <ul className="flex flex-col divide-y divide-divider">
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

      <DialogFooter>
        <ActionBar
          label="More to do with this programme"
          primary={
            carryingOn === null ? (
              <Button variant="glossy" size="lg" isLoading disabled>
                Reading the episodes
              </Button>
            ) : (
              <Button
                variant="glossy"
                size="lg"
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
            )
          }
          actions={[
            ...(carryingOn === null || onInspect === undefined
              ? []
              : [
                  {
                    id: 'episode',
                    label: 'About this episode',
                    icon: <Icon of={InformationCircleIcon} size={18} />,
                    onChoose: () => {
                      onInspect(carryingOn.episode);
                    },
                  },
                ]),
            ...(!canKeepFiles() || (shown.seriesId ?? null) === null
              ? []
              : [
                  {
                    id: 'download',
                    label: 'Download the programme',
                    icon: <Icon of={Download04Icon} size={18} />,
                    onChoose: () => {
                      setIsDownloading(true);
                    },
                  },
                ]),
            ...(onShare === undefined || (shown.seriesId ?? null) === null
              ? []
              : [
                  {
                    id: 'share',
                    label: 'Share',
                    icon: <Icon of={Link01Icon} size={18} />,
                    onChoose: () => {
                      onShare(shown);
                    },
                  },
                ]),
          ]}
        />
      </DialogFooter>

      <DownloadDialog
        series={
          isDownloading && (shown.seriesId ?? null) !== null
            ? { id: shown.seriesId ?? '', title: shown.title, episodes: shown.episodeCount }
            : null
        }
        media={null}
        onClose={() => {
          setIsDownloading(false);
        }}
      />
    </Dialog>
  );
};

ShowDialog.displayName = 'ShowDialog';

export { ShowDialog };
