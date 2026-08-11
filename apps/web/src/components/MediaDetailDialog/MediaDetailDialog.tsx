import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  IconHeart,
  IconHeartFilled,
  IconInfoCircle,
  IconPlayerPlayFilled,
  IconRotateClockwise,
  IconX,
} from '@tabler/icons-react'
import DialogModule from '@FluxUI/Dialog'
import ButtonModule from '@FluxUI/Button'
import IconButtonModule from '@FluxUI/IconButton'
import BadgeModule from '@FluxUI/Badge'
import SkeletonModule from '@FluxUI/Skeleton'
import MediaCardModule from '@FluxUI/MediaCard'
import revealModule from '@FluxUI/animations/reveal'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import MediaPreviewModule from '@FluxWeb/components/MediaPreview/MediaPreview'
import MediaFactsModule from '@FluxWeb/components/MediaFacts/MediaFacts'
import CastGridModule from './components/CastGrid/CastGrid'
import type { MediaDetail, MediaSummary } from '@FluxContracts/schemas/Library'
import type { MediaDetailDialogProps } from './MediaDetailDialog.types'

const { Dialog } = DialogModule
const { Button } = ButtonModule
const { IconButton } = IconButtonModule
const { Badge } = BadgeModule
const { Skeleton } = SkeletonModule
const { MediaCard } = MediaCardModule
const { revealVariants, revealTransition, staggerVariants } = revealModule
const { formatDuration } = formatDurationModule
const { fetchMediaDetail } = fetchLibraryModule
const { MediaPreview } = MediaPreviewModule
const { MediaFacts } = MediaFactsModule
const { CastGrid } = CastGridModule

/**
 * How many faces stand in for a cast that has not arrived.
 */
const CAST_PLACEHOLDERS = 5

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string, kind: 'poster' | 'backdrop'): string =>
  `/api/media/${mediaId}/image/${kind}`

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
  isKept = false,
  onToggleKept,
}: MediaDetailDialogProps) => {
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastShown, setLastShown] = useState<MediaSummary | null>(null)
  const heldRef = useRef<{ resume: number | undefined; siblings: MediaSummary[] }>({
    resume: undefined,
    siblings: [],
  })
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    // Nothing is thrown away on the way out. The panel is still on screen
    // while it leaves, and clearing what is written on it the moment the item
    // clears empties the thing being watched leave. Opening the next item
    // clears it below, before anything of that item is drawn.
    if (media === null) {
      return
    }

    setLastShown(media)

    // Back to the top on the way in, and again when one episode leads to
    // another: arriving at a new page halfway down it is arriving lost. Taken
    // rather than jumped, so it reads as the page returning to its beginning
    // instead of as a different page appearing.
    topRef.current?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion === true ? 'auto' : 'smooth',
    })

    let abandoned = false

    setDetail(null)
    setIsLoading(true)

    void fetchMediaDetail(media.id).then((found) => {
      if (!abandoned) {
        setDetail(found)
        setIsLoading(false)
      }
    })

    return () => {
      abandoned = true
    }
  }, [media])

  // Everything the panel says about the item is held the same way. These are
  // worked out from the item being inspected, so they empty at the moment it
  // clears — leaving a panel that changes its mind about how far the viewer
  // got and what else there is to watch, on its way out.
  //
  // Kept in a hand rather than in state: the list of what else there is is
  // built afresh by whatever renders this, so remembering it through a state
  // update would be a new list every time, and a new list every time is a
  // render that asks for another one.
  if (media !== null) {
    heldRef.current = { resume: resumeSeconds, siblings }
  }

  // The last thing shown is kept so the panel has something to draw while it
  // is leaving. Returning nothing the moment the item clears would unmount the
  // dialog before it could animate out, which reads as it vanishing.
  const shown = media ?? lastShown
  const shownResume = media === null ? heldRef.current.resume : resumeSeconds
  const shownSiblings = media === null ? heldRef.current.siblings : siblings

  if (shown === null) {
    return null
  }

  const metadata = detail?.metadata ?? null
  const season = metadata?.seasonNumber ?? null
  const genres = metadata?.genres ?? []
  const cast = metadata?.cast ?? []

  return (
    <Dialog
      label={shown.title}
      isOpen={media !== null}
      onClose={onClose}
      // Full screen on a phone and a panel on a desktop: a sheet with margins
      // around it wastes the only screen a phone has.
      className="h-full w-full max-w-none rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-[min(60rem,94vw)] sm:rounded-3xl"
    >
      {/* Everything about the item, keyed on the item. One episode leading to
          another is a new page rather than the same page with the words
          swapped, and saying so is what gives it the way in that arriving from
          anywhere else has. */}
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
                    // Over the picture with the other controls rather than in
                    // the row of words below. Keeping something is a mark made
                    // on it, not one of the two things you might do next.
                    actions: (
                      <IconButton
                        label={isKept ? `Stop keeping ${shown.title}` : `Keep ${shown.title}`}
                        isActive={isKept}
                        className="bg-black/50 text-white backdrop-blur"
                        onClick={() => {
                          onToggleKept(shown)
                        }}
                      >
                        {isKept ? (
                          <IconHeartFilled size={18} aria-hidden />
                        ) : (
                          <IconHeart size={18} aria-hidden />
                        )}
                      </IconButton>
                    ),
                  })}
              // Once, then back to the picture and the words about it. A clip
              // that keeps restarting behind everything somebody is trying to
              // read is a clip competing with the page it belongs to.
              repeats={false}
              fills
              onPlayingChange={setIsPreviewPlaying}
            />
          </div>

          {/* Only the lower part, which is all the blend into the panel needs.
            Covering the whole picture dimmed everything drawn inside it —
            subtitles included, since a browser draws those within the video
            rather than over it. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />

          <div className="absolute right-4 top-4">
            <IconButton label="Close" onClick={onClose} className="bg-black/50 text-white">
              <IconX size={20} aria-hidden />
            </IconButton>
          </div>

          {/* Everything written over the picture steps back once the picture is
            moving. It is there to describe a still, and a still is exactly
            what it stops being. */}
          <motion.div
            variants={staggerVariants}
            initial="hidden"
            animate="shown"
            className={`absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 transition-opacity duration-700 sm:p-8 ${
              isPreviewPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            {/* The episode above the show and the genres beside them, so the
              title underneath is the one thing set large. What is being
              offered is the episode; what makes it recognisable is the show,
              and a page that leads with the episode name is a page about
              something nobody has heard of. */}
            <motion.div
              variants={revealVariants(prefersReducedMotion)}
              transition={revealTransition(prefersReducedMotion)}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-sm font-medium uppercase tracking-[0.2em] text-text-muted">
                {shown.seriesTitle === null || shown.seriesTitle === undefined ? null : shown.title}
              </span>

              {genres.length === 0 ? null : (
                <span className="flex flex-wrap gap-1.5">
                  {genres.map((label) => (
                    // Carrying their own backdrop. Everything else here is
                    // written on a fade to the page's own colour; a badge sits
                    // above where that fade has reached, and an outline on a
                    // bright still is an outline nobody can read.
                    <Badge key={label} size="sm" className="bg-surface/70 backdrop-blur">
                      {label}
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
            {/* Resuming is the offer, not the alternative: somebody who left a
              film an hour in came back to carry on, and starting again is the
              rarer thing they should still be able to say. */}
            <Button
              variant="glossy"
              size="lg"
              isPill
              onClick={() => {
                onPlay(shown, shownResume ?? 0)
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
                  onPlay(shown, 0)
                }}
              >
                <IconRotateClockwise size={18} aria-hidden />
                Start again
              </Button>
            )}
          </div>

          {/* The poster beside the words rather than nowhere at all. The
            picture at the top of this page is a frame of the film, chosen by
            nobody; the poster is what somebody designed to say what this is,
            and a page about an item that never shows it is missing the one
            image made for the purpose. */}
          <section className="flex flex-col gap-5 sm:flex-row sm:gap-8">
            {!shown.hasPoster ? null : (
              <span className="w-32 shrink-0 overflow-hidden rounded-xl bg-surface-raised shadow-lg ring-1 ring-white/10 sm:w-44">
                <img
                  src={artworkUrl(shown.id, 'poster')}
                  alt=""
                  loading="lazy"
                  className="aspect-[2/3] h-full w-full object-cover"
                />
              </span>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                <p className="max-w-prose text-[0.95rem] leading-relaxed text-text">
                  {metadata.overview}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-text-muted">
                  <IconInfoCircle size={16} aria-hidden />
                  No synopsis yet. Configure a metadata provider and rescan to fill this in.
                </p>
              )}
            </div>
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
                        onSelectSibling?.(sibling)
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.div>
    </Dialog>
  )
}

MediaDetailDialog.displayName = 'MediaDetailDialog'

export default { MediaDetailDialog }
