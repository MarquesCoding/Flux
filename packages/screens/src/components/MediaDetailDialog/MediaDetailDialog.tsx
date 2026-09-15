import { Icon } from '@ValenceUI/Icon';
import { titleLogoUrl } from '@ValenceScreens/library/titleLogoUrl';
import { TitleLogo } from '@ValenceScreens/components/TitleLogo/TitleLogo';
import {
  ArrowLeft01Icon,
  ArrowTurnForwardIcon,
  Cancel01Icon,
  Download04Icon,
  FavouriteIcon,
  InformationCircleIcon,
  PlayIcon,
  Share08Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotionConfig } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { Dialog } from '@ValenceUI/Dialog';
import { DialogContent } from '@ValenceUI/DialogContent';
import { ActionBar } from '@ValenceUI/ActionBar';
import { OptionMenu } from '@ValenceUI/OptionMenu';
import { canKeepFiles } from '@ValenceClient/downloads/canKeepFiles';
import { downloadQueries } from '@ValenceClient/query/downloadQueries';
import { Spinner } from '@ValenceUI/Spinner';
import { DownloadDialog } from '@ValenceScreens/components/DownloadDialog/DownloadDialog';
import { DialogFooter } from '@ValenceUI/DialogFooter';
import { useHasScrolledPast } from '@ValenceUI/useHasScrolledPast';
import { ScrolledTitle } from '@ValenceScreens/components/ScrolledTitle/ScrolledTitle';
import { BackdropScrim } from '@ValenceUI/BackdropScrim';
import { Badge } from '@ValenceUI/Badge';
import { Skeleton } from '@ValenceUI/Skeleton';
import { MediaCard } from '@ValenceUI/MediaCard';
import { Rail } from '@ValenceUI/Rail';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { formatDuration } from '@ValenceCore/functions/formatDuration';
import { CouldNotRead } from '@ValenceUI/CouldNotRead';
import { useQuery } from '@tanstack/react-query';
import { useHeldWhileLeaving } from '@ValenceClient/shell/useHeldWhileLeaving';
import { libraryQueries } from '@ValenceClient/query/libraryQueries';
import { MediaPreview } from '@ValenceScreens/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@ValenceScreens/components/MediaFacts/MediaFacts';
import { scrollToTopOf } from '@ValenceScreens/navigation/scrollToTopOf';
import { RatingPanel } from '@ValenceScreens/components/RatingPanel/RatingPanel';
import { CastGrid } from './components/CastGrid/CastGrid';
import { EXTRA_KIND_LABELS } from '@ValenceContracts/schemas/Library';
import type { MediaSummary } from '@ValenceContracts/schemas/Library';
import type { MediaDetailDialogProps } from './MediaDetailDialog.types';

const ORIGINAL_VERSION = 'Original';

const CAST_PLACEHOLDERS = 5;

/**
 * Builds the address an item's artwork is served from, served by Valence rather than by the catalogue so
 * that a library keeps working when the catalogue does not.
 *
 * @param mediaId - The item.
 * @param kind - Which artwork.
 * @returns The address to load.
 */
const artworkUrl = (mediaId: string, kind: 'poster' | 'backdrop'): string =>
  `/api/media/${mediaId}/image/${kind}`;

/**
 * Everything known about one item, for deciding whether to watch it: what it is about, who is in it,
 * how it was made, and where this viewer left it. Offers both carrying on and starting again, since
 * those are different intentions and only one of them can be the default.
 *
 * @param media - The item, or null while none is open.
 * @param onClose - Told when the dialog was dismissed.
 * @param onPlay - Told to start it, and where from.
 * @param resumeSeconds - Where this viewer left it.
 * @param watchedFractionFor - How far through each sibling they are.
 * @param siblings - The other episodes of the same season.
 * @param onSelectSibling - Told which sibling was chosen.
 * @param onBack - Told to go back to whatever opened this.
 * @param backLabel - What going back is called.
 * @param isKept - Whether it is kept.
 * @param onToggleKept - Told to keep it, or stop.
 * @param onRate - Told what they gave it, or null to take the rating back.
 * @param onOpenPerson - Told which performer to open from the cast, where opening one is offered.
 * @param onShare - Told to hand out a link to it, where this account may share at all.
 * @param onStartParty - Told to open a watch party on it, where this account may hold one.
 */
const MediaDetailDialog = ({
  media,
  onClose,
  onPlay,
  resumeSeconds,
  watchedFractionFor,
  siblings = [],
  onSelectSibling,
  onBack,
  backLabel,
  isKept = false,
  onToggleKept,
  onRate,
  onOpenPerson,
  onShare,
  onStartParty,
}: MediaDetailDialogProps) => {
  const asked = useQuery(libraryQueries.detail(media?.id ?? null));
  const detail = useHeldWhileLeaving(asked.data ?? null, media !== null);
  const isLoading = media !== null && asked.isPending;

  const [unlettered, setUnlettered] = useState<string | null>(null);
  const [lastShown, setLastShown] = useState<MediaSummary | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const heldRef = useRef<{ resume: number | undefined; siblings: MediaSummary[] }>({
    resume: undefined,
    siblings: [],
  });
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const { mark: pastTheArtwork, hasPassed: hasScrolledPast } = useHasScrolledPast();
  const [isDownloading, setIsDownloading] = useState(false);

  const prepared = useQuery({ ...downloadQueries.all(), enabled: canKeepFiles() });

  const prefersReducedMotion = useReducedMotionConfig();

  useEffect(() => {
    if (media === null) {
      return;
    }

    setLastShown(media);
    setIsPreviewPlaying(false);
    setUnlettered(null);
    setVersion(null);

    const returning = requestAnimationFrame(() => {
      scrollToTopOf(topRef.current, prefersReducedMotion !== true);
    });

    return () => {
      cancelAnimationFrame(returning);
    };
  }, [media, prefersReducedMotion]);

  if (media !== null) {
    heldRef.current = { resume: resumeSeconds, siblings };
  }

  const shown = media ?? lastShown;

  const preparing = (prepared.data ?? []).find(
    (one) => one.mediaId === shown?.id && one.state !== 'ready' && one.state !== 'failed',
  );

  const percent = `${Math.round((preparing?.progress ?? 0) * 100).toString()}%`;
  const shownResume = media === null ? heldRef.current.resume : resumeSeconds;
  const shownSiblings = media === null ? heldRef.current.siblings : siblings;
  const extras = detail?.extras ?? [];
  const versions = detail?.versions ?? [];
  const chosenVersion = versions.find((one) => one.id === version) ?? null;

  if (shown === null) {
    return null;
  }

  const metadata = detail?.metadata ?? null;
  const season = metadata?.seasonNumber ?? null;
  const genres = metadata?.genres ?? [];
  const cast = metadata?.cast ?? [];

  return (
    <Dialog label={shown.title} isOpen={media !== null} onClose={onClose} size="stage">
      <DialogContent className="p-3 sm:p-4">
        <ScrolledTitle
          title={shown.title}
          artwork={shown.hasPoster ? artworkUrl(shown.id, 'poster') : null}
          isShowing={hasScrolledPast}
        >
          <Button isIconOnly variant="ghost" size="sm" label="Close" onClick={onClose}>
            <Icon of={Cancel01Icon} size={16} />
          </Button>
        </ScrolledTitle>

        <motion.div
          key={shown.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion === true ? 0 : 0.35, ease: 'easeOut' }}
        >
          <div ref={topRef} className="relative overflow-hidden rounded-2xl">
            <div className="relative h-[42vh] min-h-[16rem] sm:h-[26rem]">
              <MediaPreview
                mediaId={shown.id}
                backdropUrl={shown.hasBackdrop ? artworkUrl(shown.id, 'backdrop') : null}
                durationSeconds={shown.durationSeconds}
                hasSound
                {...(onToggleKept === undefined
                  ? {}
                  : {
                      actions: (
                        <Button
                          isIconOnly
                          variant="overlay"
                          label={isKept ? `Stop keeping ${shown.title}` : `Keep ${shown.title}`}
                          isActive={isKept}
                          onClick={() => {
                            onToggleKept(shown);
                          }}
                        >
                          {isKept ? (
                            <Icon of={FavouriteIcon} size={18} />
                          ) : (
                            <Icon of={FavouriteIcon} size={18} />
                          )}
                        </Button>
                      ),
                    })}
                repeats={false}
                fills
                onPlayingChange={setIsPreviewPlaying}
              />

              <BackdropScrim
                className={`transition-opacity duration-700 ${
                  isPreviewPlaying ? 'opacity-0' : 'opacity-100'
                }`}
              />
            </div>

            {onBack === undefined ? null : (
              <div className="absolute left-4 top-4">
                <Button variant="overlay" size="sm" onClick={onBack}>
                  <Icon of={ArrowLeft01Icon} size={16} />
                  {backLabel ?? 'Back'}
                </Button>
              </div>
            )}

            <div className="absolute right-4 top-4">
              <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
                <Icon of={Cancel01Icon} size={20} />
              </Button>
            </div>

            <motion.div
              variants={staggerVariants}
              initial="hidden"
              animate="shown"
              className={`absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 transition-opacity duration-700 sm:p-8 ${
                isPreviewPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              {shown.hasLogo && unlettered !== shown.id ? (
                <motion.div
                  variants={revealVariants(prefersReducedMotion)}
                  transition={revealTransition(prefersReducedMotion)}
                >
                  <TitleLogo
                    src={titleLogoUrl(shown.id)}
                    alt=""
                    className="max-h-[7svh] w-auto max-w-[min(55vw,15rem)] object-contain object-left"
                    onError={() => {
                      setUnlettered(shown.id);
                    }}
                  />
                </motion.div>
              ) : null}

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-on-scrim/75">
                  {shown.seriesTitle === null || shown.seriesTitle === undefined
                    ? null
                    : shown.title}
                </span>
              </motion.div>

              <motion.h2
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion, 'heavy')}
                className="max-w-[16ch] text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-on-scrim"
              >
                {shown.seriesTitle ?? shown.title}
              </motion.h2>

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
              >
                <MediaFacts
                  media={shown}
                  hasRuntime
                  className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-on-scrim/75"
                />
              </motion.div>
            </motion.div>
          </div>

          <span ref={pastTheArtwork} aria-hidden className="block h-px" />

          <div className="flex flex-col gap-8 px-2 pb-4 pt-7 sm:px-4">
            {onRate === undefined ? null : (
              <RatingPanel
                subject={{ mediaId: shown.id }}
                title={shown.title}
                onRate={(given) => {
                  onRate(shown, given);
                }}
              />
            )}

            {media !== null && asked.isError ? (
              <CouldNotRead
                what="The rest of this"
                isTryingAgain={asked.isFetching}
                onTryAgain={() => {
                  void asked.refetch();
                }}
              />
            ) : null}

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                Synopsis
              </h3>

              {isLoading ? (
                <div aria-hidden className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[92%]" />
                  <Skeleton className="h-4 w-[70%]" />
                </div>
              ) : typeof metadata?.overview === 'string' && metadata.overview !== '' ? (
                <p className="text-[0.95rem] leading-relaxed text-text">{metadata.overview}</p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-text-muted">
                  <Icon of={InformationCircleIcon} size={16} />
                  No synopsis yet. Configure a metadata provider and rescan to fill this in.
                </p>
              )}

              {genres.length === 0 ? null : (
                <span className="flex flex-wrap gap-1.5">
                  {genres.map((label) => (
                    <Badge key={label} size="sm">
                      {label}
                    </Badge>
                  ))}
                </span>
              )}
            </section>

            <section className="flex flex-col gap-3">
              {isLoading ? (
                <>
                  <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                    Cast
                  </h3>

                  <ul aria-hidden className="flex gap-4">
                    {Array.from({ length: CAST_PLACEHOLDERS }, (_, index) => index).map((index) => (
                      <li key={index} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                        <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                      </li>
                    ))}
                  </ul>
                </>
              ) : cast.length === 0 ? (
                <>
                  <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                    Cast
                  </h3>

                  <p className="flex items-center gap-2 text-sm text-text-muted">
                    <Icon of={InformationCircleIcon} size={16} />
                    Nobody is credited yet. A metadata provider supplies the cast.
                  </p>
                </>
              ) : (
                <CastGrid
                  members={cast}
                  {...(onOpenPerson === undefined ? {} : { onOpenPerson })}
                />
              )}
            </section>

            {extras.length === 0 ? null : (
              <Rail title="Extras" sizesCards className="px-0">
                {extras.map((extra) => (
                  <li key={extra.id}>
                    <MediaCard
                      {...(extra.extraKind === null || extra.extraKind === undefined
                        ? {}
                        : { eyebrow: EXTRA_KIND_LABELS[extra.extraKind] })}
                      title={extra.title}
                      subtitle={
                        <MediaFacts
                          media={extra}
                          hasRuntime
                          className="flex flex-wrap items-center gap-2"
                        />
                      }
                      shape="wide"
                      {...(extra.hasBackdrop ? { imageUrl: artworkUrl(extra.id, 'backdrop') } : {})}
                      onSelect={() => {
                        onPlay(extra, 0);
                      }}
                    />
                  </li>
                ))}
              </Rail>
            )}

            {shownSiblings.length === 0 ? null : (
              <Rail
                title={
                  season === null
                    ? 'More from this series'
                    : `More from season ${season.toString()}`
                }
                sizesCards
                className="px-0"
              >
                {shownSiblings.map((sibling) => (
                  <li key={sibling.id}>
                    <MediaCard
                      {...(sibling.seriesTitle === null || sibling.seriesTitle === undefined
                        ? {}
                        : { eyebrow: sibling.title })}
                      title={sibling.seriesTitle ?? sibling.title}
                      subtitle={
                        <MediaFacts
                          media={sibling}
                          hasRuntime
                          className="flex flex-wrap items-center gap-2"
                        />
                      }
                      shape="wide"
                      {...(watchedFractionFor?.(sibling.id) === undefined
                        ? {}
                        : { watchedFraction: watchedFractionFor(sibling.id) ?? 0 })}
                      {...(sibling.hasBackdrop
                        ? { imageUrl: artworkUrl(sibling.id, 'backdrop') }
                        : {})}
                      onSelect={() => {
                        onSelectSibling?.(sibling);
                      }}
                    />
                  </li>
                ))}
              </Rail>
            )}
          </div>
        </motion.div>
      </DialogContent>

      <DialogFooter>
        <ActionBar
          label="More to do with this"
          primary={
            <div className="flex w-full items-center gap-2">
              {versions.length === 0 ? null : (
                <OptionMenu
                  label="Which version to play"
                  triggerShape="field"
                  trigger={chosenVersion?.versionLabel ?? ORIGINAL_VERSION}
                  groups={[
                    {
                      name: 'Version',
                      options: [
                        { id: shown.id, label: ORIGINAL_VERSION },
                        ...versions.map((one) => ({
                          id: one.id,
                          label: one.versionLabel ?? 'Another version',
                        })),
                      ],
                      selectedId: chosenVersion?.id ?? shown.id,
                      onSelect: setVersion,
                    },
                  ]}
                />
              )}

              <Button
                variant="glossy"
                size="lg"
                className="min-w-0 flex-1"
                onClick={() => {
                  onPlay(chosenVersion ?? shown, chosenVersion === null ? (shownResume ?? 0) : 0);
                }}
              >
                <Icon of={PlayIcon} size={18} />
                {shownResume === undefined || chosenVersion !== null
                  ? 'Play'
                  : `Resume from ${formatDuration(shownResume)}`}
              </Button>
            </div>
          }
          actions={[
            ...(shownResume === undefined
              ? []
              : [
                  {
                    id: 'again',
                    label: 'Start again',
                    icon: <Icon of={ArrowTurnForwardIcon} size={18} />,
                    onChoose: () => {
                      onPlay(shown, 0);
                    },
                  },
                ]),
            ...(onShare === undefined
              ? []
              : [
                  {
                    id: 'share',
                    label: 'Share',
                    icon: <Icon of={Share08Icon} size={18} />,
                    onChoose: () => {
                      onShare(shown);
                    },
                  },
                ]),
            ...(canKeepFiles()
              ? [
                  {
                    id: 'download',
                    label: preparing === undefined ? 'Download' : `Preparing ${percent}`,
                    icon:
                      preparing === undefined ? (
                        <Icon of={Download04Icon} size={18} />
                      ) : (
                        <Spinner size="sm" label="Preparing" />
                      ),
                    onChoose: () => {
                      setIsDownloading(true);
                    },
                  },
                ]
              : []),
            ...(onStartParty === undefined
              ? []
              : [
                  {
                    id: 'party',
                    label: 'Watch together',
                    icon: <Icon of={UserGroupIcon} size={18} />,
                    onChoose: () => {
                      onStartParty(shown);
                    },
                  },
                ]),
          ]}
        />
      </DialogFooter>

      <DownloadDialog
        media={isDownloading ? shown : null}
        onClose={() => {
          setIsDownloading(false);
        }}
      />
    </Dialog>
  );
};

MediaDetailDialog.displayName = 'MediaDetailDialog';

export { MediaDetailDialog };
