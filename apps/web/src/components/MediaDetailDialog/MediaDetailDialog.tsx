import { useEffect, useState } from 'react'
import { IconPlayerPlay, IconStar, IconX } from '@tabler/icons-react'
import DialogModule from '@FluxUI/Dialog'
import ButtonModule from '@FluxUI/Button'
import IconButtonModule from '@FluxUI/IconButton'
import SpinnerModule from '@FluxUI/Spinner'
import MediaCardModule from '@FluxUI/MediaCard'
import formatDurationModule from '@FluxCore/functions/formatDuration'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import describeMediaModule from '@FluxWeb/components/LibraryBrowser/describeMedia'
import MediaPreviewModule from './components/MediaPreview/MediaPreview'
import type { MediaDetail } from '@FluxContracts/schemas/Library'
import type { MediaDetailDialogProps } from './MediaDetailDialog.types'

const { Dialog } = DialogModule
const { Button } = ButtonModule
const { IconButton } = IconButtonModule
const { Spinner } = SpinnerModule
const { MediaCard } = MediaCardModule
const { formatDuration } = formatDurationModule
const { fetchMediaDetail } = fetchLibraryModule
const { describeBadges } = describeMediaModule
const { MediaPreview } = MediaPreviewModule

/**
 * Where an item's artwork is served from.
 */
const artworkUrl = (mediaId: string, kind: 'poster' | 'backdrop'): string =>
  `/api/media/${mediaId}/image/${kind}`

/**
 * Everything known about one item, before deciding to watch it.
 *
 * What appears depends entirely on what is known: with no metadata provider
 * configured there is a title, a runtime and the technical facts from the
 * probe, and the dialog shows those rather than a page of empty labels.
 */
const MediaDetailDialog = ({
  media,
  onClose,
  onPlay,
  siblings = [],
  onSelectSibling,
}: MediaDetailDialogProps) => {
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (media === null) {
      setDetail(null)

      return
    }

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

  if (media === null) {
    return null
  }

  const metadata = detail?.metadata ?? null
  const season = metadata?.seasonNumber ?? null

  return (
    <Dialog label={media.title} isOpen onClose={onClose} className="p-0">
      <div className="relative">
        <MediaPreview
          mediaId={media.id}
          backdropUrl={media.hasBackdrop ? artworkUrl(media.id, 'backdrop') : null}
          durationSeconds={media.durationSeconds}
        />

        <div className="absolute right-3 top-3">
          <IconButton label="Close" size="sm" onClick={onClose} className="bg-black/50 text-white">
            <IconX size={18} aria-hidden />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-text">{media.title}</h2>

            <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              {media.year === null ? null : <span>{media.year}</span>}
              <span>{formatDuration(media.durationSeconds)}</span>
              {metadata?.rating === undefined || metadata.rating === null ? null : (
                <span className="flex items-center gap-1">
                  <IconStar size={14} aria-hidden />
                  {metadata.rating.toFixed(1)}
                </span>
              )}
              {typeof metadata?.seasonNumber !== 'number' ||
              typeof metadata.episodeNumber !== 'number' ? null : (
                <span>
                  Season {metadata.seasonNumber}, episode {metadata.episodeNumber}
                </span>
              )}
            </p>

            {typeof metadata?.tagline !== 'string' || metadata.tagline === '' ? null : (
              <p className="text-sm italic text-text-muted">{metadata.tagline}</p>
            )}
          </div>

          <Button
            size="lg"
            onClick={() => {
              onPlay(media)
            }}
          >
            <IconPlayerPlay size={18} fill="currentColor" aria-hidden />
            Play
          </Button>
        </div>

        {isLoading ? <Spinner label="Loading details" size="sm" /> : null}

        {typeof metadata?.overview !== 'string' || metadata.overview === '' ? null : (
          <p className="max-w-prose text-text">{metadata.overview}</p>
        )}

        <ul className="flex flex-wrap gap-2">
          {[...(metadata?.genres ?? []), ...describeBadges(media)].map((label) => (
            <li
              key={label}
              className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-text-muted"
            >
              {label}
            </li>
          ))}
        </ul>

        {metadata?.cast === undefined ||
        metadata.cast === null ||
        metadata.cast.length === 0 ? null : (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text">Cast</h3>

            <ul className="flex gap-3 overflow-x-auto pb-2">
              {metadata.cast.map((member) => (
                <li key={member.name} className="flex w-24 shrink-0 flex-col items-center gap-1">
                  <span className="size-16 overflow-hidden rounded-full bg-surface-raised">
                    {member.imageUrl === null ? null : (
                      <img
                        src={member.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>

                  <span className="text-center text-xs font-medium text-text">{member.name}</span>
                  <span className="text-center text-[11px] text-text-muted">{member.role}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {siblings.length === 0 ? null : (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text">
              {season === null ? 'More from this series' : `More from season ${season.toString()}`}
            </h3>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {siblings.map((sibling) => (
                <li key={sibling.id}>
                  <MediaCard
                    title={sibling.title}
                    subtitle={formatDuration(sibling.durationSeconds)}
                    shape="wide"
                    {...(sibling.hasBackdrop
                      ? { imageUrl: artworkUrl(sibling.id, 'backdrop') }
                      : {})}
                    onSelect={() => {
                      onSelectSibling?.(sibling)
                    }}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
  )
}

MediaDetailDialog.displayName = 'MediaDetailDialog'

export default { MediaDetailDialog }
