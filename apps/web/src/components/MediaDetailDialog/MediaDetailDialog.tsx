import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  IconArrowLeft,
  IconHeart,
  IconHeartFilled,
  IconInfoCircle,
  IconPlayerPlayFilled,
  IconRotateClockwise,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@FluxUI/Button';
import { Dialog } from '@FluxUI/Dialog';
import { DialogContent } from '@FluxUI/DialogContent';
import { Badge } from '@FluxUI/Badge';
import { Skeleton } from '@FluxUI/Skeleton';
import { MediaCard } from '@FluxUI/MediaCard';
import { revealVariants, revealTransition, staggerVariants } from '@FluxUI/animations/reveal';
import { formatDuration } from '@FluxCore/functions/formatDuration';
import { fetchMediaDetail } from '@FluxWeb/library/fetchLibrary';
import { MediaPreview } from '@FluxWeb/components/MediaPreview/MediaPreview';
import { MediaFacts } from '@FluxWeb/components/MediaFacts/MediaFacts';
import { scrollToTopOf } from '@FluxWeb/navigation/scrollToTopOf';
import { CastGrid } from './components/CastGrid/CastGrid';
import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library';
import type { MediaDetailDialogProps } from './MediaDetailDialog.types';

/**
 * How many faces stand in for a cast that has not arrived.
 */
const CAST_PLACEHOLDERS = 5;

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string, kind: 'poster' | 'backdrop'): string =>
  `/api/media/${mediaId}/image/${kind}`;

/**
 * Everything known about one item, before deciding to watch it.
 *
 * Laid out like a page about a film rather than a form about a file: the
 * preview runs across the top with the title over it, and the detail reads
 * down the page in the order someone wants it — what it is, who is in it, what
 * else there is.
 *
 * While the details are arriving, the shapes they will occupy are drawn in
 * their place. A panel that fills in without moving can be read as it loads;
 * one that grows as each part lands cannot.
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
}: MediaDetailDialogProps) => {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  /**
   * Whether the description is still being read.
   *
   * Cleared when the dialog closes as well as when a read finishes: closing
   * part-way through abandons whatever was in flight, so nothing was left to
   * turn this off, and the next thing opened inherited it — showing its
   * skeletons over a description that had already arrived.
   */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * The item whose lettering would not load, so the title falls back to words.
   */
  const [unlettered, setUnlettered] = useState<string | null>(null);
  const [lastShown, setLastShown] = useState<MediaSummary | null>(null);
  const heldRef = useRef<{ resume: number | undefined; siblings: MediaSummary[] }>({
    resume: undefined,
    siblings: [],
  });
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (media === null) {
      setIsLoading(false);
      setDetail(null);

      return;
    }

    setLastShown(media);

    const returning = requestAnimationFrame(() => {
      scrollToTopOf(topRef.current, prefersReducedMotion !== true);
    });

    let abandoned = false;

    setDetail(null);
    setIsLoading(true);

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found);
        setIsLoading(false);
      }
    });

    return () => {
      abandoned = true;
      cancelAnimationFrame(returning);
    };
  }, [media, prefersReducedMotion]);

  if (media !== null) {
    heldRef.current = { resume: resumeSeconds, siblings };
  }

  const shown = media ?? lastShown;
  const shownResume = media === null ? heldRef.current.resume : resumeSeconds;
  const shownSiblings = media === null ? heldRef.current.siblings : siblings;

  if (shown === null) {
    return null;
  }

  const metadata = detail?.metadata ?? null;
  const season = metadata?.seasonNumber ?? null;
  const genres = metadata?.genres ?? [];
  const cast = metadata?.cast ?? [];

  return (
    <Dialog
      label={shown.title}
      isOpen={media !== null}
      onClose={onClose}
      className="h-full w-full max-w-none rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-3xl"
    >
      <DialogContent className="p-0">
        <motion.div
          key={shown.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion === true ? 0 : 0.35, ease: 'easeOut' }}
        >
          <div ref={topRef} className="relative">
            <div className="h-[42vh] min-h-[16rem] sm:h-[26rem]">
              <MediaPreview
                mediaId={shown.id}
                backdropUrl={shown.hasBackdrop ? artworkUrl(shown.id, 'backdrop') : null}
                durationSeconds={shown.durationSeconds}
                hasSound
                hasSubtitles
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
                            <IconHeartFilled size={18} aria-hidden />
                          ) : (
                            <IconHeart size={18} aria-hidden />
                          )}
                        </Button>
                      ),
                    })}
                repeats={false}
                fills
                onPlayingChange={setIsPreviewPlaying}
              />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

            {onBack === undefined ? null : (
              <div className="absolute left-4 top-4">
                <Button variant="overlay" size="sm" isPill onClick={onBack}>
                  <IconArrowLeft size={16} aria-hidden />
                  {backLabel ?? 'Back'}
                </Button>
              </div>
            )}

            <div className="absolute right-4 top-4">
              <Button isIconOnly variant="overlay" label="Close" onClick={onClose}>
                <IconX size={20} aria-hidden />
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
                <motion.img
                  variants={revealVariants(prefersReducedMotion)}
                  transition={revealTransition(prefersReducedMotion)}
                  src={`/api/media/${shown.id}/image/logo`}
                  alt=""
                  className="max-h-[7svh] w-auto max-w-[min(55vw,15rem)] object-contain object-left"
                  onError={() => {
                    setUnlettered(shown.id);
                  }}
                />
              ) : null}

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-text-muted">
                  {shown.seriesTitle === null || shown.seriesTitle === undefined
                    ? null
                    : shown.title}
                </span>
              </motion.div>

              <motion.h2
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion, 'heavy')}
                className="max-w-[16ch] text-[clamp(2rem,6vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-text"
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
                  className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-[0.14em] text-text-muted"
                />
              </motion.div>
            </motion.div>
          </div>

          <div className="flex flex-col gap-8 p-5 pb-10 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="glossy"
                size="lg"
                isPill
                onClick={() => {
                  onPlay(shown, shownResume ?? 0);
                }}
              >
                <IconPlayerPlayFilled size={18} aria-hidden />
                {shownResume === undefined ? 'Play' : `Resume from ${formatDuration(shownResume)}`}
              </Button>

              {shownResume === undefined ? null : (
                <Button
                  variant="secondary"
                  size="lg"
                  isPill
                  onClick={() => {
                    onPlay(shown, 0);
                  }}
                >
                  <IconRotateClockwise size={18} aria-hidden />
                  Start again
                </Button>
              )}
            </div>

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
                  <IconInfoCircle size={16} aria-hidden />
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
                        <Skeleton className="aspect-[2/3] w-full rounded-xl" />
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
                    <IconInfoCircle size={16} aria-hidden />
                    Nobody is credited yet. A metadata provider supplies the cast.
                  </p>
                </>
              ) : (
                <CastGrid members={cast} />
              )}
            </section>

            {shownSiblings.length === 0 ? null : (
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
                  {season === null
                    ? 'More from this series'
                    : `More from season ${season.toString()}`}
                </h3>

                <ul className="flux-rail -my-6 flex gap-4 overflow-x-auto px-1 py-6">
                  {shownSiblings.map((sibling) => (
                    <li key={sibling.id} className="w-56 shrink-0 sm:w-64">
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
                </ul>
              </section>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

MediaDetailDialog.displayName = 'MediaDetailDialog';

export { MediaDetailDialog };
