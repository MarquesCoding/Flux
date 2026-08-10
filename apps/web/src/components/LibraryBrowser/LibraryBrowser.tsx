import { useCallback, useEffect, useState } from 'react'
import { IconRefresh, IconRefreshAlert, IconSearch } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import MediaCardModule from '@FluxUI/MediaCard'
import SpinnerModule from '@FluxUI/Spinner'
import fetchLibraryModule from '@FluxWeb/library/fetchLibrary'
import RailModule from '@FluxUI/Rail'
import HeroModule from '@FluxWeb/components/Hero/Hero'
import groupIntoRailsModule from '@FluxWeb/library/groupIntoRails'
import watchProgressModule from '@FluxWeb/playback/watchProgress'
import WatchProgressContract from '@FluxContracts/schemas/WatchProgress'
import describeMediaModule from './describeMedia'
import type { Library, MediaSummary } from '@FluxContracts/schemas/Library'
import type { WatchProgress } from '@FluxContracts/schemas/WatchProgress'
import type { BrowserState, LibraryBrowserProps } from './LibraryBrowser.types'

const { Button } = ButtonModule
const { MediaCard } = MediaCardModule
const { Hero } = HeroModule
const { Rail } = RailModule
const { groupIntoRails } = groupIntoRailsModule
const { fetchWatchProgress, byMediaId } = watchProgressModule
const { watchedFraction } = WatchProgressContract

/**
 * How many items the hero rotates between.
 *
 * A handful: a carousel of thirty is a carousel nobody reaches the end of.
 */
const HERO_COUNT = 5
const { Spinner } = SpinnerModule
const { fetchLibraries, fetchLibraryItems, scanLibrary } = fetchLibraryModule
const { describeMedia, describeBadges } = describeMediaModule

const PAGE_SIZE = 60
const SEARCH_DEBOUNCE_MS = 250

/**
 * Browses a library.
 *
 * Search is debounced and served by the database rather than filtered in the
 * browser: the client only ever holds one page, so filtering here would search
 * the page rather than the library and quietly lie about the results.
 */
const LibraryBrowser = ({
  search = '',
  hasHero = false,
  isSearching = false,
  onSearchChange,
  onFeatureChange,
  onPlay,
}: LibraryBrowserProps) => {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<MediaSummary[]>([])
  const [total, setTotal] = useState(0)
  const [appliedSearch, setAppliedSearch] = useState('')
  const [progress, setProgress] = useState(new Map<string, WatchProgress>())
  const [state, setState] = useState<BrowserState>('loading')
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    let abandoned = false

    fetchLibraries()
      .then((found) => {
        if (abandoned) {
          return
        }

        setLibraries(found)
        setSelectedId(found[0]?.id ?? null)
        setState('ready')
      })
      .catch(() => {
        if (!abandoned) {
          setState('unreachable')
        }
      })

    return () => {
      abandoned = true
    }
  }, [])

  useEffect(() => {
    let abandoned = false

    // Fetched once for the whole library rather than per card: a page of
    // hundreds would otherwise open hundreds of connections to draw hundreds
    // of thin bars.
    void fetchWatchProgress().then((found) => {
      if (!abandoned) {
        setProgress(byMediaId(found))
      }
    })

    return () => {
      abandoned = true
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [search])

  const loadItems = useCallback(async () => {
    if (selectedId === null) {
      return
    }

    try {
      const page = await fetchLibraryItems(selectedId, {
        search: appliedSearch,
        limit: PAGE_SIZE,
      })

      setItems(page.items)
      setTotal(page.total)
    } catch {
      setState('unreachable')
    }
  }, [selectedId, appliedSearch])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const rescan = async (force: boolean) => {
    if (selectedId === null) {
      return
    }

    setIsScanning(true)

    try {
      await scanLibrary(selectedId, force)
      await loadItems()
    } finally {
      setIsScanning(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading your library" size="lg" />
      </div>
    )
  }

  if (state === 'unreachable') {
    return (
      <p role="alert" className="text-sm text-danger">
        Your library could not be loaded. Check that the server is running and reload.
      </p>
    )
  }

  if (libraries.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-text">No libraries yet</h2>
        <p className="text-text-muted">
          Add a library pointing at a folder of media, then scan it to see your films here.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {isSearching ? (
        <div className="flex flex-col gap-4 px-5 pt-14 sm:px-10">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">Search</h1>

          <label className="flex items-center gap-3 border-b border-white/15 pb-3">
            <IconSearch size={28} className="shrink-0 text-text-muted" aria-hidden />
            <span className="sr-only">Search the library</span>

            <input
              type="search"
              autoFocus
              value={search}
              placeholder="Everything you own"
              onChange={(event) => {
                onSearchChange?.(event.target.value)
              }}
              className="w-full bg-transparent text-2xl tracking-tight text-text outline-none placeholder:text-text-muted/50 sm:text-3xl"
            />
          </label>
        </div>
      ) : null}

      {hasHero && items.length > 0 ? (
        <Hero
          items={items.slice(0, HERO_COUNT)}
          onPlay={onPlay}
          onInspect={onPlay}
          {...(onFeatureChange === undefined ? {} : { onFeatureChange })}
        />
      ) : null}

      <section className="flex flex-col gap-5 px-5 sm:px-10">
        <header className="flux-rail flex items-center gap-3 overflow-x-auto pb-1">
          <div className="flex shrink-0 items-center gap-2">
            {total === 0 ? null : (
              <span className="mr-1 text-sm text-text-muted">
                {total === 1 ? '1 item' : `${String(total)} items`}
              </span>
            )}

            {libraries.map((entry) => (
              <Button
                key={entry.id}
                size="sm"
                isPill
                variant={entry.id === selectedId ? 'glossy' : 'secondary'}
                onClick={() => {
                  setSelectedId(entry.id)
                }}
              >
                {entry.name}
              </Button>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              isPill
              isLoading={isScanning}
              onClick={() => {
                void rescan(false)
              }}
            >
              <IconRefresh size={16} aria-hidden />
              Scan
            </Button>

            <Button
              variant="ghost"
              size="sm"
              isPill
              disabled={isScanning}
              // Named once and shortened only on screen: two visible labels
              // would both be read aloud, so what is spoken stays the same
              // whatever the width.
              aria-label="Full rescan"
              onClick={() => {
                void rescan(true)
              }}
            >
              <IconRefreshAlert size={16} aria-hidden />
              <span aria-hidden className="hidden sm:inline">
                Full rescan
              </span>
              <span aria-hidden className="sm:hidden">
                All
              </span>
            </Button>
          </div>
        </header>

        {items.length === 0 ? (
          <p className="text-text-muted">
            {appliedSearch === ''
              ? 'This library is empty. Scan it to find your media.'
              : `Nothing matches “${appliedSearch}”.`}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            {groupIntoRails(items).map((rail) => (
              <Rail key={rail.id} title={rail.title} className="px-0">
                {rail.items.map((media) => (
                  <li key={media.id} className="w-[70vw] shrink-0 snap-start sm:w-72 lg:w-80">
                    <MediaCard
                      title={media.title}
                      subtitle={describeMedia(media)}
                      badges={describeBadges(media)}
                      shape="wide"
                      {...(progress.has(media.id)
                        ? {
                            watchedFraction: watchedFraction(
                              progress.get(media.id) ?? {
                                mediaId: media.id,
                                positionSeconds: 0,
                                durationSeconds: media.durationSeconds,
                                isFinished: false,
                                updatedAt: media.addedAt,
                              },
                            ),
                          }
                        : {})}
                      {...(media.hasBackdrop
                        ? { imageUrl: `/api/media/${media.id}/image/backdrop` }
                        : media.hasPoster
                          ? { imageUrl: `/api/media/${media.id}/image/poster` }
                          : {})}
                      onSelect={() => {
                        onPlay(media)
                      }}
                      className="w-full"
                    />
                  </li>
                ))}
              </Rail>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

LibraryBrowser.displayName = 'LibraryBrowser'

export default { LibraryBrowser }
